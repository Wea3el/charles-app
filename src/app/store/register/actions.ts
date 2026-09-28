"use server";

import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cancelTerminalCheckout, createTerminalCheckout, getTerminalCheckout, squareConfigured } from "@/lib/square";
import type { Enums } from "@/lib/database.types";

export type CardResult =
  | { ok: true; checkoutId: string; status: Enums<"checkout_status">; paymentId: string | null; squareCheckoutId: string | null }
  | { ok: false; message: string };

const STATUS: Record<string, Enums<"checkout_status">> = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  CANCEL_REQUESTED: "cancel_requested",
  CANCELED: "canceled",
  COMPLETED: "completed",
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong talking to Square");

/** Send the total to the Square Terminal. Returns our checkout row id to poll. */
export async function startCardCheckout(saleClientId: string, amountCents: number): Promise<CardResult> {
  await requireStaff();
  if (!squareConfigured()) {
    return { ok: false, message: "The Square Terminal is not connected yet. Run the card on the terminal by hand, then tap “Card paid on terminal”." };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { ok: false, message: "Nothing to charge" };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("terminal_checkouts")
    .insert({ sale_client_id: saleClientId, amount: amountCents / 100 })
    .select("id")
    .single();
  if (error) return { ok: false, message: error.message };

  try {
    const checkout = await createTerminalCheckout(row.id, amountCents, saleClientId);
    const status = STATUS[checkout.status] ?? "pending";
    await supabase
      .from("terminal_checkouts")
      .update({ square_checkout_id: checkout.id, status, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true, checkoutId: row.id, status, paymentId: null, squareCheckoutId: checkout.id };
  } catch (e) {
    await supabase.from("terminal_checkouts").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: false, message: errorMessage(e) };
  }
}

/** Ask Square where the checkout is (the register polls this). */
export async function checkCardCheckout(checkoutId: string): Promise<CardResult> {
  await requireStaff();
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("terminal_checkouts").select("*").eq("id", checkoutId).single();
  if (error) return { ok: false, message: error.message };
  if (!row.square_checkout_id) return { ok: false, message: "This checkout never reached Square" };
  try {
    const checkout = await getTerminalCheckout(row.square_checkout_id);
    const status = STATUS[checkout.status] ?? row.status;
    const paymentId = checkout.payment_ids?.[0] ?? null;
    if (status !== row.status || paymentId !== row.square_payment_id) {
      await supabase
        .from("terminal_checkouts")
        .update({ status, square_payment_id: paymentId, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }
    return { ok: true, checkoutId: row.id, status, paymentId, squareCheckoutId: row.square_checkout_id };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}

export async function cancelCardCheckout(checkoutId: string): Promise<CardResult> {
  await requireStaff();
  const supabase = await createClient();
  const { data: row, error } = await supabase.from("terminal_checkouts").select("*").eq("id", checkoutId).single();
  if (error) return { ok: false, message: error.message };
  if (!row.square_checkout_id) return { ok: false, message: "This checkout never reached Square" };
  try {
    const checkout = await cancelTerminalCheckout(row.square_checkout_id);
    const status = STATUS[checkout.status] ?? "cancel_requested";
    await supabase.from("terminal_checkouts").update({ status, updated_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true, checkoutId: row.id, status, paymentId: null, squareCheckoutId: row.square_checkout_id };
  } catch (e) {
    return { ok: false, message: errorMessage(e) };
  }
}
