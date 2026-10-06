import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/email";
import { toCents } from "@/lib/register";
import { createPaymentLink, findCompletedPayment, refundPayment, squareOnlineConfigured } from "@/lib/square";

/**
 * Online card payments (server only). Payments are written with the service
 * role, and only after Square says they went through, so a browser can never
 * mark an order paid. Refunds run as the signed-in staff member.
 */

/** The Square checkout page for an order: reused while the amount is unchanged. Null once paid. */
export async function startOnlinePayment(orderId: string): Promise<string | null> {
  if (!squareOnlineConfigured()) throw new Error("Online payment isn't set up yet.");
  const admin = createAdminClient();
  const { data: o, error } = await admin
    .from("orders")
    .select("id, order_number, status, total, payment_status, pay_online, square_payment_link_url, square_payment_link_amount, customers(email)")
    .eq("id", orderId)
    .single();
  if (error || !o) throw new Error("Order not found.");
  if (!o.pay_online) throw new Error("This order is paid at pickup or delivery.");
  if (o.status === "cancelled") throw new Error("This order was cancelled.");
  if (o.payment_status === "paid") return null;

  // A link is tied to an amount; the same order and amount always give the same link.
  const amountCents = toCents(o.total);
  if (o.square_payment_link_url && o.square_payment_link_amount !== null && toCents(o.square_payment_link_amount) === amountCents) {
    return o.square_payment_link_url;
  }

  const link = await createPaymentLink({
    idempotencyKey: `${o.id}:${amountCents}`,
    amountCents,
    name: `Order #${o.order_number}`,
    note: `Charles order #${o.order_number}`,
    redirectUrl: `${await siteUrl()}/shop/paid?order=${o.id}`,
    buyerEmail: o.customers?.email,
  });
  await admin
    .from("orders")
    .update({
      square_payment_link_id: link.id,
      square_payment_link_url: link.url,
      square_payment_link_amount: amountCents / 100,
      square_order_id: link.order_id,
    })
    .eq("id", o.id);
  return link.url;
}

/** Ask Square whether the order's checkout page has been paid, and record it if so. */
export async function syncOnlinePayment(orderId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("id, square_order_id, payment_status").eq("id", orderId).single();
  if (!o?.square_order_id) return false;
  if (o.payment_status === "paid") return true;
  const payment = await findCompletedPayment(o.square_order_id);
  if (!payment) return false;
  return recordPaymentForSquareOrder(o.square_order_id, payment.id, payment.amount_money.amount);
}

/** Record a completed Square payment against our order (webhook or return page). Safe to repeat. */
export async function recordPaymentForSquareOrder(squareOrderId: string, paymentId: string, amountCents: number): Promise<boolean> {
  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("id").eq("square_order_id", squareOrderId).maybeSingle();
  if (!o) return false;
  const { data: status, error } = await admin.rpc("record_online_payment", {
    p_order: o.id,
    p_square_payment_id: paymentId,
    p_amount: amountCents / 100,
  });
  if (error) throw new Error(error.message);
  return status === "paid";
}

/**
 * Refund whatever was paid online beyond the order's total (short lines, or
 * everything when `all`). Runs as staff. Returns the cents refunded.
 */
export async function refundOverpayment(orderId: string, reason: string, all = false): Promise<number> {
  const supabase = await createClient();
  const { data: o, error } = await supabase
    .from("orders")
    .select("id, total, payments(amount, square_payment_id, square_refund_id)")
    .eq("id", orderId)
    .single();
  if (error || !o) throw new Error("Order not found.");

  const netCents = o.payments.reduce((t, p) => t + toCents(p.amount), 0);
  const cardPayments = o.payments.filter((p) => p.square_payment_id);
  const owedBack = all ? netCents : netCents - toCents(o.total);
  if (owedBack <= 0 || cardPayments.length === 0) return 0;

  // Refund against the largest card payment, never more than it took.
  const payment = cardPayments.reduce((a, b) => (toCents(b.amount) > toCents(a.amount) ? b : a));
  const cents = Math.min(owedBack, toCents(payment.amount));
  const refundsSoFar = o.payments.filter((p) => p.square_refund_id).length;
  const refund = await refundPayment({
    idempotencyKey: `${orderId}:refund${refundsSoFar}:${cents}`,
    paymentId: payment.square_payment_id!,
    amountCents: cents,
    reason,
  });
  const { error: recordError } = await supabase.rpc("record_order_refund", {
    p_order: orderId,
    p_amount: cents / 100,
    p_square_refund_id: refund.id,
    p_reason: reason,
  });
  if (recordError) throw new Error(`Square refunded ${(cents / 100).toFixed(2)}, but saving it failed: ${recordError.message}`);
  return cents;
}
