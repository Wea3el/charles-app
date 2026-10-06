/**
 * Square APIs (server only: uses the access token).
 * Terminal API for the register, Checkout API (payment links) for paying
 * online, Refunds API for giving back what staff couldn't fill.
 * https://developer.squareup.com/reference/square
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const SQUARE_VERSION = "2025-01-23";

export type SquareCheckoutStatus = "PENDING" | "IN_PROGRESS" | "CANCEL_REQUESTED" | "CANCELED" | "COMPLETED";

export interface SquareCheckout {
  id: string;
  status: SquareCheckoutStatus;
  payment_ids?: string[];
  cancel_reason?: string;
}

function config() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) return null;
  const base = process.env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  return { token, base, deviceId: process.env.SQUARE_TERMINAL_DEVICE_ID, locationId: process.env.SQUARE_LOCATION_ID };
}

/** The register's card terminal is set up. */
export function squareConfigured() {
  const c = config();
  return !!c?.deviceId;
}

/** Online payments are set up (also needs the service role key, to record them). */
export function squareOnlineConfigured() {
  const c = config();
  return !!c?.locationId && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const c = config();
  if (!c) throw new Error("Square is not set up yet");
  const res = await fetch(`${c.base}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${c.token}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? `Square returned ${res.status}`;
    throw new Error(detail);
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Terminal (register)
// ---------------------------------------------------------------------------

/** Send an amount to the terminal. idempotencyKey makes a retried request safe. */
export async function createTerminalCheckout(idempotencyKey: string, amountCents: number, referenceId: string) {
  const c = config();
  const { checkout } = await call<{ checkout: SquareCheckout }>("/v2/terminals/checkouts", {
    method: "POST",
    body: {
      idempotency_key: idempotencyKey,
      checkout: {
        amount_money: { amount: amountCents, currency: "USD" },
        reference_id: referenceId,
        device_options: { device_id: c?.deviceId, skip_receipt_screen: false },
      },
    },
  });
  return checkout;
}

export async function getTerminalCheckout(checkoutId: string) {
  const { checkout } = await call<{ checkout: SquareCheckout }>(`/v2/terminals/checkouts/${encodeURIComponent(checkoutId)}`);
  return checkout;
}

export async function cancelTerminalCheckout(checkoutId: string) {
  const { checkout } = await call<{ checkout: SquareCheckout }>(
    `/v2/terminals/checkouts/${encodeURIComponent(checkoutId)}/cancel`,
    { method: "POST" },
  );
  return checkout;
}

// ---------------------------------------------------------------------------
// Online: hosted checkout page, payments, refunds
// ---------------------------------------------------------------------------

export interface PaymentLink {
  id: string;
  url: string;
  order_id: string;
}

/** A Square-hosted checkout page for one amount. Card numbers never touch our site. */
export async function createPaymentLink(p: {
  idempotencyKey: string;
  amountCents: number;
  name: string;
  note: string;
  redirectUrl: string;
  buyerEmail?: string | null;
}) {
  const c = config();
  const { payment_link } = await call<{ payment_link: PaymentLink }>("/v2/online-checkout/payment-links", {
    method: "POST",
    body: {
      idempotency_key: p.idempotencyKey,
      quick_pay: { name: p.name, price_money: { amount: p.amountCents, currency: "USD" }, location_id: c?.locationId },
      checkout_options: { redirect_url: p.redirectUrl, ask_for_shipping_address: false },
      pre_populated_data: p.buyerEmail ? { buyer_email: p.buyerEmail } : undefined,
      payment_note: p.note,
    },
  });
  return payment_link;
}

export interface SquarePayment {
  id: string;
  status: "APPROVED" | "PENDING" | "COMPLETED" | "CANCELED" | "FAILED";
  order_id?: string;
  amount_money: { amount: number; currency: string };
}

/** The completed payment for a payment link's Square order, if the customer has paid. */
export async function findCompletedPayment(squareOrderId: string): Promise<SquarePayment | null> {
  const { order } = await call<{ order: { tenders?: { payment_id?: string }[] } }>(`/v2/orders/${encodeURIComponent(squareOrderId)}`);
  for (const t of order.tenders ?? []) {
    if (!t.payment_id) continue;
    const { payment } = await call<{ payment: SquarePayment }>(`/v2/payments/${encodeURIComponent(t.payment_id)}`);
    if (payment.status === "COMPLETED") return payment;
  }
  return null;
}

/** Give money back on a card payment. idempotencyKey makes a retried refund safe. */
export async function refundPayment(p: { idempotencyKey: string; paymentId: string; amountCents: number; reason: string }) {
  const { refund } = await call<{ refund: { id: string; status: string } }>("/v2/refunds", {
    method: "POST",
    body: {
      idempotency_key: p.idempotencyKey,
      payment_id: p.paymentId,
      amount_money: { amount: p.amountCents, currency: "USD" },
      reason: p.reason.slice(0, 192),
    },
  });
  return refund;
}

/**
 * Square signs each webhook: base64 HMAC-SHA256 of (notification URL + raw body),
 * keyed with the subscription's signature key.
 */
export function verifyWebhookSignature(body: string, signature: string | null, notificationUrl: string, signatureKey: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", signatureKey).update(notificationUrl + body).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
