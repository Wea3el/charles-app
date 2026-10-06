import Link from "next/link";
import { Badge, Notice, PageShell } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { dayPhrase, STATUS_TAG, storeClock, unitWord } from "@/lib/orders";
import { formatCents } from "@/lib/pricing";
import { toCents } from "@/lib/register";
import { createClient } from "@/lib/supabase/server";

const COLUMNS =
  "id, order_number, status, customer_kind, channel, fulfillment_date, placed_at, total, payment_status, pay_online, customers(business_name, contact_name), order_lines(requested_qty)";

export default async function OrdersPage() {
  await requireStaff();
  const supabase = await createClient();
  const [{ data: open, error }, { data: recent }, { data: settings }] = await Promise.all([
    supabase.from("orders").select(COLUMNS).in("status", ["submitted", "confirmed", "partially_confirmed"]).order("placed_at"),
    supabase.from("orders").select(COLUMNS).in("status", ["completed", "cancelled"]).order("placed_at", { ascending: false }).limit(20),
    supabase.from("settings").select("timezone").single(),
  ]);
  const timeZone = settings?.timezone ?? "America/New_York";
  const today = storeClock(new Date(), timeZone).date;
  const time = new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short", timeZone });

  type Row = NonNullable<typeof open>[number];
  // First come, first served: new orders in the order they came in.
  const fresh = (open ?? []).filter((o) => o.status === "submitted");
  const toFill = (open ?? [])
    .filter((o) => o.status !== "submitted")
    .sort((a, b) => a.fulfillment_date.localeCompare(b.fulfillment_date) || a.placed_at.localeCompare(b.placed_at));

  const list = (rows: Row[], empty: string) =>
    rows.length === 0 ? (
      <p className="!m-0 text-(--color-neutral-700)">{empty}</p>
    ) : (
      <ul className="!m-0 flex list-none flex-col gap-2 !p-0">
        {rows.map((o) => {
          const count = o.order_lines.reduce((t, l) => t + l.requested_qty, 0);
          const late = o.status !== "completed" && o.status !== "cancelled" && o.fulfillment_date < today;
          return (
            <li key={o.id}>
              <Link
                href={`/store/orders/${o.id}`}
                className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 border border-(--color-divider) px-4 py-2.5 !text-(--color-text) !no-underline hover:bg-(--color-accent-100)"
              >
                <span className="font-semibold">#{o.order_number}</span>
                <span className="min-w-[160px] font-semibold">{o.customers?.business_name ?? o.customers?.contact_name}</span>
                <Badge>{o.customer_kind}</Badge>
                <Badge tone={o.status === "submitted" ? "warn" : "neutral"}>{STATUS_TAG[o.status]}</Badge>
                <span className={late ? "font-semibold text-(--color-accent-900)" : ""}>
                  {o.customer_kind === "wholesale" ? "Delivery" : "Pickup"} {late ? `was due ${o.fulfillment_date}` : dayPhrase(o.fulfillment_date, today)}
                </span>
                <span className="text-(--color-neutral-700)">
                  {unitWord(o.customer_kind, count)} · placed {time.format(new Date(o.placed_at))}
                </span>
                <span className="ml-auto font-semibold tabular-nums">{formatCents(toCents(o.total))}</span>
                {(o.pay_online || (o.status !== "submitted" && o.status !== "cancelled")) && (
                  <Badge tone={o.payment_status === "paid" ? "neutral" : "warn"}>
                    {o.pay_online ? (o.payment_status === "paid" ? "paid online" : "not paid online yet") : o.payment_status}
                  </Badge>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    );

  return (
    <PageShell lead="Online orders. Confirm new ones in the order they came in; stock comes out when you confirm.">
      {error && <Notice ok={false}>{error.message}</Notice>}
      <section className="flex flex-col gap-2.5">
        <h3 className="!m-0">New, to confirm{fresh.length > 0 && ` · ${fresh.length}`}</h3>
        {list(fresh, "No new orders.")}
      </section>
      <section className="flex flex-col gap-2.5">
        <h3 className="!m-0">Confirmed, to hand over{toFill.length > 0 && ` · ${toFill.length}`}</h3>
        {list(toFill, "Nothing waiting.")}
      </section>
      <section className="flex flex-col gap-2.5">
        <h3 className="!m-0">Recently done</h3>
        {list(recent ?? [], "Nothing yet.")}
      </section>
    </PageShell>
  );
}
