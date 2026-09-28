/**
 * Square Terminal API (server only: uses the access token).
 * https://developer.squareup.com/reference/square/terminal-api
 */

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
  const deviceId = process.env.SQUARE_TERMINAL_DEVICE_ID;
  if (!token || !deviceId) return null;
  const base = process.env.SQUARE_ENVIRONMENT === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  return { token, deviceId, base };
}

export function squareConfigured() {
  return config() !== null;
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
