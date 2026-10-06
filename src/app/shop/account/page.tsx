import { redirect } from "next/navigation";
import { Badge, ButtonLink, Notice } from "@/components/ui";
import { getShopViewer } from "@/lib/auth";
import { dayPhrase, paymentName, STATUS_TEXT, storeClock, unitWord } from "@/lib/orders";
import { formatCents } from "@/lib/pricing";
import { toCents } from "@/lib/register";
import { loadShopSettings } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { ShopShell } from "../ShopShell";

const money = (v: number | null) => formatCents(toCents(v ?? 0));

const LINE_TEXT = { pending: "", confirmed: "", partial: "part filled", declined: "declined" } as const;

export default async function AccountPage() {
  const { customer } = await getShopViewer();
  if (!customer) redirect("/shop/signin?next=/shop/account");

  const supabase = await createClient();
  const [{ data: orders, error }, settings] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "id, order_number, status, fulfillment_date, placed_at, payment_method, pay_online, payment_status, subtotal, discount_amount, card_fee, total, cancel_reason, order_lines(id, product_name, option_label, requested_qty, confirmed_qty, status, unit_price)",
      )
      .eq("customer_id", customer.id)
      .order("placed_at", { ascending: false })
      .limit(50),
    loadShopSettings(),
  ]);
  const today = storeClock(new Date(), settings.timeZone).date;
  const wholesale = customer.kind === "wholesale";

  return (
    <ShopShell kind={customer.kind} title="My orders" lead={customer.business_name ?? customer.contact_name}>
      {customer.status === "pending" && (
        <Notice ok={false}>Your business account is waiting for approval. We&apos;ll email you once the store has checked your license.</Notice>
      )}
      {(customer.status === "rejected" || customer.status === "suspended") && (
        <Notice ok={false}>This account can&apos;t order online right now. Call the store.</Notice>
      )}
      {error && <Notice ok={false}>{error.message}</Notice>}
      <div>
        <ButtonLink variant="primary" href={`/shop/${customer.kind}`}>
          Shop {customer.kind}
        </ButtonLink>
      </div>
      {orders?.length === 0 && <p className="!m-0 text-(--color-neutral-700)">No orders yet.</p>}
      <ul className="!m-0 flex list-none flex-col gap-3 !p-0">
        {orders?.map((o) => {
          const count = o.order_lines.reduce((t, l) => t + l.requested_qty, 0);
          const settled = o.status !== "submitted";
          return (
            <li key={o.id} className="border border-(--color-divider)">
              <details open={o.status === "submitted" || o.fulfillment_date >= today}>
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-(--color-accent-100)">
                  <span className="font-semibold">#{o.order_number}</span>
                  <span>
                    {wholesale ? "Delivery" : "Pickup"} {dayPhrase(o.fulfillment_date, today)}
                  </span>
                  <Badge tone={o.status === "submitted" || o.status === "partially_confirmed" ? "warn" : "neutral"}>{STATUS_TEXT[o.status]}</Badge>
                  <span className="text-(--color-neutral-700)">{unitWord(customer.kind, count)}</span>
                  <span className="ml-auto font-semibold tabular-nums">{money(o.total)}</span>
                </summary>
                <div className="border-t border-(--color-divider) px-4 py-3 text-sm">
                  <table className="table">
                    <tbody>
                      {o.order_lines.map((l) => (
                        <tr key={l.id} className={l.status === "declined" ? "text-(--color-neutral-700)" : ""}>
                          <td>
                            {l.product_name} · {l.option_label}
                          </td>
                          <td className="tabular-nums">
                            {settled && l.status !== "confirmed" ? `${l.confirmed_qty ?? 0} of ${l.requested_qty}` : l.requested_qty} × {money(l.unit_price)}
                          </td>
                          <td className="font-semibold text-(--color-accent-900)">{LINE_TEXT[l.status]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-2 space-y-0.5 text-right">
                    {Number(o.discount_amount) > 0 && <div>Discount −{money(o.discount_amount)}</div>}
                    {Number(o.card_fee) > 0 && <div>Card fee {money(o.card_fee)}</div>}
                    <div className="font-semibold">
                      {o.status === "submitted" ? "Estimated total" : "Total"} {money(o.total)}
                    </div>
                    <div className="text-(--color-neutral-700)">
                      {o.pay_online ? "Paid online" : paymentName(o.payment_method)} · {o.payment_status}
                    </div>
                    {o.pay_online && o.payment_status !== "paid" && o.status !== "cancelled" && (
                      <ButtonLink variant="primary" href={`/shop/pay/${o.id}`} className="mt-2">
                        Pay now
                      </ButtonLink>
                    )}
                  </div>
                  {o.cancel_reason && <p className="!mt-2 !mb-0 font-semibold text-(--color-accent-900)">Cancelled: {o.cancel_reason}</p>}
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </ShopShell>
  );
}
