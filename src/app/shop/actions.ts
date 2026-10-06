"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, siteUrl } from "@/lib/email";
import { orderReceivedEmail, storeClock, type OrderKind, type PaymentMethod } from "@/lib/orders";
import { formatCents } from "@/lib/pricing";
import { toCents } from "@/lib/register";
import { startOnlinePayment } from "@/lib/payments";
import { loadShopSettings } from "@/lib/shop";

export interface PlaceOrderInput {
  client_id: string;
  kind: OrderKind;
  fulfillment_date: string;
  payment_method: PaymentMethod;
  pay_online?: boolean; // card, paid now on Square's page
  notes?: string;
  lines: { option_id: string; quantity: number }[];
}

/** Retail checkout without an account. */
export interface GuestDetails {
  name: string;
  email: string;
  phone: string;
  age_21: boolean;
}

export type PlaceOrderResult =
  | { ok: true; orderNumber: number; count: number; date: string; payUrl?: string }
  | { ok: false; message: string };

/** What place_order() / place_guest_order() hand back. */
interface OrderSummary {
  id: string;
  order_number: number;
  kind: OrderKind;
  fulfillment_date: string;
  total: number;
  email: string | null;
  pay_online: boolean;
  payment_status: string;
  lines: { name: string; label: string; qty: number }[];
}

export async function placeOrder(input: PlaceOrderInput, guest?: GuestDetails): Promise<PlaceOrderResult> {
  const supabase = await createClient();
  // Prices, the account and the day window are all checked in the database.
  const { data, error } = guest
    ? await supabase.rpc("place_guest_order", { p_order: { ...input }, p_guest: { ...guest } })
    : await supabase.rpc("place_order", { p_order: { ...input } });
  if (error) return { ok: false, message: error.message };
  const order = data as unknown as OrderSummary;

  // Paying online: send them to Square's page. The order stays placed either way;
  // if the page can't be made now, the "Finish paying" link tries again.
  const site = await siteUrl();
  const payLink = order.pay_online && order.payment_status !== "paid" ? `${site}/shop/pay/${order.id}` : undefined;
  let payUrl: string | undefined;
  if (payLink) {
    try {
      payUrl = (await startOnlinePayment(order.id)) ?? undefined;
    } catch (e) {
      console.error("[place order] payment link", e);
      payUrl = `${site}/shop/paid?order=${order.id}&error=1`;
    }
  }

  const settings = await loadShopSettings();
  await sendEmail(
    order.email,
    orderReceivedEmail({
      number: order.order_number,
      kind: order.kind,
      date: order.fulfillment_date,
      today: storeClock(new Date(), settings.timeZone).date,
      total: formatCents(toCents(order.total)),
      accountUrl: guest ? undefined : `${site}/shop/account`,
      payUrl: payLink,
      lines: order.lines.map((l) => ({ name: l.name, label: l.label, requested: l.qty, confirmed: null, status: "pending" })),
    }),
  );
  revalidatePath("/store/orders");
  return { ok: true, orderNumber: order.order_number, count: order.lines.reduce((t, l) => t + l.qty, 0), date: order.fulfillment_date, payUrl };
}
