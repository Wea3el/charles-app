import { Notice } from "@/components/ui";
import { dayPhrase, storeClock, unitWord } from "@/lib/orders";
import { loadShopSettings, type ShopKind } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/**
 * "Order sent: ..." after checkout. A signed-in customer's order is read back;
 * a guest can't read orders, so their count and day come from the redirect.
 */
export async function PlacedNotice({ kind, params }: { kind: ShopKind; params: Record<string, string | string[] | undefined> }) {
  const n = Number(str(params.placed));
  if (!Number.isInteger(n) || n <= 0) return null;
  const supabase = await createClient();
  const [{ data: order }, settings] = await Promise.all([
    supabase.from("orders").select("fulfillment_date, order_lines(requested_qty)").eq("order_number", n).maybeSingle(),
    loadShopSettings(),
  ]);
  const count = order ? order.order_lines.reduce((t, l) => t + l.requested_qty, 0) : Number(str(params.n));
  const date = order?.fulfillment_date ?? str(params.day);
  if (!Number.isInteger(count) || count <= 0 || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const when = dayPhrase(date, storeClock(new Date(), settings.timeZone).date);
  return (
    <Notice ok>
      Order #{n} sent: {unitWord(kind, count)} for {kind === "wholesale" ? "delivery" : "pickup"} {when}. We&apos;ll email you when it&apos;s
      confirmed.
    </Notice>
  );
}
