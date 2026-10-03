import { PageShell } from "@/components/ui";
import { Badge, Button, ButtonLink, Card, Input, Notice } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { formatCents } from "@/lib/pricing";
import { toCents } from "@/lib/register";
import { createClient } from "@/lib/supabase/server";
import { VoidForm } from "./VoidForm";

const money = (v: number | null) => formatCents(toCents(v ?? 0));

/** YYYY-MM-DD for a moment, in the store's time zone. */
const localDate = (d: Date, timeZone: string) => new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);

function shiftDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function SalesPage(props: PageProps<"/store/sales">) {
  const staff = await requireStaff();
  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("timezone").single();
  const timeZone = settings?.timezone ?? "America/New_York";

  const params = await props.searchParams;
  const today = localDate(new Date(), timeZone);
  const date = typeof params.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : today;

  // A day in the store's time zone always sits inside this UTC window.
  const [{ data: totals }, { data: rows, error }] = await Promise.all([
    supabase.from("register_daily").select("*").eq("sale_date", date),
    supabase
      .from("sales")
      .select(
        "id, sale_number, sold_at, price_mode, subtotal, discount_amount, total, cash_tendered, change_given, recorded_offline, square_payment_id, voided_at, void_reason, cashier:staff!sales_staff_id_fkey(full_name), voider:staff!sales_voided_by_fkey(full_name), sale_lines(id, pack_label, quantity, unit_price, line_discount, line_total, products(name))",
      )
      .gte("sold_at", `${shiftDays(date, -1)}T00:00:00Z`)
      .lt("sold_at", `${shiftDays(date, 2)}T00:00:00Z`)
      .order("sold_at", { ascending: false }),
  ]);
  const sales = (rows ?? []).filter((s) => localDate(new Date(s.sold_at), timeZone) === date);

  const time = new Intl.DateTimeFormat("en-US", { timeStyle: "short", timeZone });
  const by = (mode: "cash" | "card") => totals?.find((t) => t.price_mode === mode);
  const all = (totals ?? []).reduce(
    (a, t) => ({ count: a.count + (t.sales_count ?? 0), total: a.total + toCents(t.total ?? 0), discounts: a.discounts + toCents(t.discounts ?? 0) }),
    { count: 0, total: 0, discounts: 0 },
  );
  const voided = sales.filter((s) => s.voided_at).length;

  return (
    <PageShell lead="Register sales for one day, in store time. Voided sales are left out of the totals.">
      <form className="flex flex-wrap items-center gap-3">
        <ButtonLink href={`/store/sales?date=${shiftDays(date, -1)}`}>← Previous day</ButtonLink>
        <Input type="date" name="date" defaultValue={date} className="!w-44" />
        <Button variant="secondary">Show</Button>
        {date !== today && <ButtonLink href="/store/sales">Today</ButtonLink>}
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-sm text-(--color-neutral-700)">Total</div>
          <div className="font-(family-name:--font-heading) text-3xl font-semibold tabular-nums">{formatCents(all.total)}</div>
          <div className="text-sm text-(--color-neutral-700)">
            {all.count} sale{all.count === 1 ? "" : "s"}
            {voided > 0 && ` · ${voided} voided`}
          </div>
        </Card>
        {(["cash", "card"] as const).map((m) => (
          <Card key={m}>
            <div className="text-sm capitalize text-(--color-neutral-700)">{m}</div>
            <div className="font-(family-name:--font-heading) text-2xl font-semibold tabular-nums">{money(by(m)?.total ?? 0)}</div>
            <div className="text-sm text-(--color-neutral-700)">
              {by(m)?.sales_count ?? 0} sales · discounts {money(by(m)?.discounts ?? 0)}
              {(by(m)?.offline_count ?? 0) > 0 && ` · ${by(m)?.offline_count} rung up offline`}
            </div>
          </Card>
        ))}
      </div>

      {error && <Notice ok={false}>{error.message}</Notice>}
      {sales.length === 0 && <p className="!m-0 text-(--color-neutral-700)">No sales on this day.</p>}
      <ul className="!m-0 flex list-none flex-col gap-3 !p-0">
        {sales.map((s) => (
          <li key={s.id} className={`border border-(--color-divider) ${s.voided_at ? "text-(--color-neutral-700)" : ""}`}>
            <details>
              <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-(--color-accent-100)">
                <span className="font-semibold">#{s.sale_number}</span>
                <span className="tabular-nums">{time.format(new Date(s.sold_at))}</span>
                <Badge tone={s.price_mode === "cash" ? "warehouse" : "retail"}>{s.price_mode}</Badge>
                {s.recorded_offline && <Badge>offline</Badge>}
                {s.voided_at && <Badge tone="warn">voided</Badge>}
                <span className="text-(--color-neutral-700)">{s.cashier?.full_name}</span>
                <span className={`ml-auto font-semibold tabular-nums ${s.voided_at ? "line-through" : ""}`}>{money(s.total)}</span>
              </summary>
              <div className="border-t border-(--color-divider) px-4 py-3 text-sm">
                <table className="table">
                  <tbody>
                    {s.sale_lines.map((l) => (
                      <tr key={l.id}>
                        <td>
                          {l.products?.name} · {l.pack_label}
                        </td>
                        <td className="tabular-nums">
                          {l.quantity} × {money(l.unit_price)}
                        </td>
                        <td className="tabular-nums text-(--color-accent-700)">
                          {Number(l.line_discount) > 0 ? `−${money(l.line_discount)}` : ""}
                        </td>
                        <td className="text-right tabular-nums">{money(l.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-2 space-y-0.5 text-right">
                  {Number(s.discount_amount) > 0 && <div>Sale discount −{money(s.discount_amount)}</div>}
                  <div className="font-semibold">Total {money(s.total)}</div>
                  {s.cash_tendered !== null && (
                    <div className="text-(--color-neutral-700)">
                      Cash {money(s.cash_tendered)} · change {money(s.change_given)}
                    </div>
                  )}
                  {s.square_payment_id && <div className="text-(--color-neutral-700)">Square payment {s.square_payment_id}</div>}
                </div>
                {s.voided_at ? (
                  <p className="!mt-2 !mb-0 font-semibold text-(--color-accent-900)">
                    Voided by {s.voider?.full_name} at {time.format(new Date(s.voided_at))}: {s.void_reason}
                  </p>
                ) : (
                  staff.role === "manager" && (
                    <div className="mt-3">
                      <VoidForm saleId={s.id} />
                    </div>
                  )
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>
    </PageShell>
  );
}
