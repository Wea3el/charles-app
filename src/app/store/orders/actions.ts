"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { done, fail, num, text, type ActionResult } from "@/lib/action";
import { sendEmail, siteUrl } from "@/lib/email";
import { orderConfirmedEmail, storeClock, type PaymentMethod } from "@/lib/orders";
import { refundOverpayment } from "@/lib/payments";
import { formatCents } from "@/lib/pricing";
import { toCents } from "@/lib/register";

/** Tell the customer how their order turned out (confirmed, part filled or cancelled). */
async function emailOutcome(orderId: string): Promise<boolean> {
  const supabase = await createClient();
  const [{ data: o }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select("order_number, customer_kind, fulfillment_date, total, status, cancel_reason, customers(email, auth_user_id), order_lines(product_name, option_label, requested_qty, confirmed_qty, status)")
      .eq("id", orderId)
      .single(),
    supabase.from("settings").select("timezone").single(),
  ]);
  if (!o) return false;
  return sendEmail(
    o.customers?.email,
    orderConfirmedEmail({
      number: o.order_number,
      kind: o.customer_kind,
      date: o.fulfillment_date,
      today: storeClock(new Date(), settings?.timezone ?? "America/New_York").date,
      total: formatCents(toCents(o.total)),
      status: o.status,
      cancelReason: o.cancel_reason,
      accountUrl: o.customers?.auth_user_id ? `${await siteUrl()}/shop/account` : undefined, // guests have no account
      lines: o.order_lines.map((l) => ({
        name: l.product_name ?? "",
        label: l.option_label ?? "",
        requested: l.requested_qty,
        confirmed: l.confirmed_qty,
        status: l.status,
      })),
    }),
  );
}

const refresh = (orderId: string) => {
  revalidatePath("/store/orders");
  revalidatePath(`/store/orders/${orderId}`);
  revalidatePath("/store");
};

/** Give back online card money beyond the new total. Never throws: the order change already happened. */
async function refundNote(orderId: string, reason: string, all = false): Promise<string> {
  try {
    const cents = await refundOverpayment(orderId, reason, all);
    return cents > 0 ? ` ${formatCents(cents)} was refunded to their card.` : "";
  } catch (e) {
    return ` The card refund didn't go through (${(e as Error).message}). Use "Refund overpayment" to try again.`;
  }
}

const emailNote = (sent: boolean) => (sent ? " The customer was emailed." : " (Email isn't set up, so tell the customer.)");

export async function confirmOrder(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const orderId = text(form, "order_id");
  if (!orderId) return fail("Pick an order.");
  const lines = [...form.entries()]
    .filter(([k]) => k.startsWith("qty_"))
    .map(([k, v]) => ({ id: k.slice(4), quantity: Number(v) }));
  if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 0)) return fail("Quantities must be whole numbers.");

  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("confirm_order", { p_order: orderId, p_lines: lines });
  if (error) return fail(error.message);
  const refunded = await refundNote(orderId, status === "cancelled" ? "Order could not be filled" : "Items short on your order");
  refresh(orderId);
  revalidatePath("/store/inventory", "layout");
  const sent = await emailOutcome(orderId);
  const what =
    status === "cancelled" ? "Nothing could be filled, so the order is cancelled." : status === "confirmed" ? "Order confirmed." : "Order confirmed with some items short.";
  return done(`${what} Stock was taken out.${refunded}${emailNote(sent)}`);
}

export async function cancelOrder(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const orderId = text(form, "order_id");
  const reason = text(form, "reason");
  if (!orderId) return fail("Pick an order.");
  if (!reason) return fail("Give a reason for cancelling.");
  // Online card payments go back first; cancel_order refuses while money is held.
  let refunded = 0;
  try {
    refunded = await refundOverpayment(orderId, `Order cancelled: ${reason}`, true);
  } catch (e) {
    return fail(`The card refund didn't go through, so the order is still open: ${(e as Error).message}`);
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order: orderId, p_reason: reason });
  if (error) return fail(refunded ? `${formatCents(refunded)} was refunded, but cancelling failed: ${error.message}` : error.message);
  refresh(orderId);
  revalidatePath("/store/inventory", "layout");
  const sent = await emailOutcome(orderId);
  const back = refunded ? ` ${formatCents(refunded)} was refunded to their card.` : "";
  return done(`Order cancelled. Anything already picked is back in stock.${back}${emailNote(sent)}`);
}

export async function completeOrder(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const orderId = text(form, "order_id");
  if (!orderId) return fail("Pick an order.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_order", { p_order: orderId });
  if (error) return fail(error.message);
  refresh(orderId);
  return done("Marked as done.");
}

const METHODS: PaymentMethod[] = ["cash", "check", "card", "zelle", "invoice"];

export async function recordPayment(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const orderId = text(form, "order_id");
  const method = text(form, "method") as PaymentMethod | null;
  const amount = num(form, "amount");
  if (!orderId) return fail("Pick an order.");
  if (!method || !METHODS.includes(method)) return fail("Pick how they paid.");
  if (amount === null || !(amount > 0)) return fail("Enter the amount paid.");
  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("record_order_payment", {
    p_order: orderId,
    p_method: method,
    p_amount: amount,
    p_reference: text(form, "reference") ?? undefined,
  });
  if (error) return fail(error.message);
  refresh(orderId);
  return done(status === "paid" ? "Payment saved. The order is paid in full." : "Payment saved. There's still a balance.");
}

/** Retry: refund online card money beyond the order total. */
export async function refundOrderOverpayment(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const orderId = text(form, "order_id");
  if (!orderId) return fail("Pick an order.");
  try {
    const cents = await refundOverpayment(orderId, "Items short on your order");
    refresh(orderId);
    return done(cents > 0 ? `${formatCents(cents)} refunded to their card.` : "Nothing to refund.");
  } catch (e) {
    return fail((e as Error).message);
  }
}
