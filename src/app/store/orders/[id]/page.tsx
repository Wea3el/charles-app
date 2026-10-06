import { notFound } from "next/navigation";
import { Badge, Card, Notice, PageShell } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { dayPhrase, paymentName, STATUS_TAG, storeClock } from "@/lib/orders";
import { formatCents } from "@/lib/pricing";
import { toCents } from "@/lib/register";
import { createClient } from "@/lib/supabase/server";
import { CancelForm, CompleteForm, ConfirmForm, PaymentForm, RefundForm, type ConfirmLine } from "./OrderForms";

const money = (v: number | null) => formatCents(toCents(v ?? 0));

export default async function OrderPage(props: PageProps<"/store/orders/[id]">) {
  await requireStaff();
  const { id } = await props.params;
  const supabase = await createClient();
  const [{ data: o }, { data: settings }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "*, customers(business_name, contact_name, email, phone, address_line, city, state, postal_code), order_lines(id, product_id, product_name, option_label, pack_units, requested_qty, confirmed_qty, status, unit_price, requested_at), payments(id, method, amount, reference, received_at, square_payment_id, square_refund_id)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("settings").select("timezone").single(),
  ]);
  if (!o) notFound();
  const timeZone = settings?.timezone ?? "America/New_York";
  const today = storeClock(new Date(), timeZone).date;
  const time = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone });
  const wholesale = o.customer_kind === "wholesale";
  const lines = [...o.order_lines].sort((a, b) => a.requested_at.localeCompare(b.requested_at) || a.id.localeCompare(b.id));

  // On hand in this order's pool: cases in the warehouse, or singles up front.
  const catalog = wholesale ? "warehouse" : "retail";
  const { data: stock } = await supabase
    .from("stock")
    .select("product_id, quantity, locations!inner(catalog)")
    .eq("locations.catalog", catalog)
    .in("product_id", [...new Set(lines.map((l) => l.product_id))]);
  const left = new Map<string, number>();
  for (const s of stock ?? []) left.set(s.product_id, (left.get(s.product_id) ?? 0) + Math.max(s.quantity, 0));

  // Suggest filling lines in the order they were asked for, sharing stock between lines of one product.
  const confirmLines: ConfirmLine[] = lines.map((l) => {
    const units = wholesale ? 1 : (l.pack_units ?? 1);
    const have = left.get(l.product_id) ?? 0;
    const suggested = Math.min(l.requested_qty, Math.floor(have / units));
    left.set(l.product_id, have - suggested * units);
    return {
      id: l.id,
      name: l.product_name ?? "",
      label: l.option_label ?? "",
      requested: l.requested_qty,
      suggested,
      onHandText: `${have} ${wholesale ? "case" : "single"}${have === 1 ? "" : "s"} on hand`,
    };
  });

  const c = o.customers;
  const open = o.status === "confirmed" || o.status === "partially_confirmed";
  const paid = o.payments.reduce((t, p) => t + toCents(p.amount), 0);
  // Online card money is refunded automatically; anything else has to be sorted out by hand.
  const handPaid = o.payments.filter((p) => !p.square_payment_id && !p.square_refund_id).reduce((t, p) => t + toCents(p.amount), 0);
  const overpaid = o.payments.some((p) => p.square_payment_id) ? paid - toCents(o.total) : 0;

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="!m-0 !text-[36px]">Order #{o.order_number}</h1>
        <Badge tone={o.status === "submitted" ? "warn" : "neutral"}>{STATUS_TAG[o.status]}</Badge>
        <Badge>{o.customer_kind}</Badge>
        <Badge>{o.channel.replace("_", " ")}</Badge>
        {o.pay_online && <Badge tone={o.payment_status === "paid" ? "neutral" : "warn"}>{o.payment_status === "paid" ? "paid online" : "online payment not finished"}</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="flex flex-col gap-1 text-sm">
          <div className="text-lg font-semibold">{c?.business_name ?? c?.contact_name}</div>
          {c?.business_name && <div>{c.contact_name}</div>}
          <div>
            {c?.phone} {c?.email && `· ${c.email}`}
          </div>
          {wholesale && c?.address_line && <div>{[c.address_line, c.city, c.state, c.postal_code].filter(Boolean).join(", ")}</div>}
        </Card>
        <Card className="flex flex-col gap-1 text-sm">
          <div className="text-lg font-semibold">
            {wholesale ? "Delivery" : "Pickup"} {dayPhrase(o.fulfillment_date, today)} ({o.fulfillment_date})
          </div>
          <div>Placed {time.format(new Date(o.placed_at))}</div>
          <div>
            {o.pay_online ? "Paying online by card" : `Pays by ${paymentName(o.payment_method)}`}
            {o.price_mode && ` (${o.price_mode} prices)`}
          </div>
          {o.notes && <div className="font-semibold">Note: {o.notes}</div>}
        </Card>
      </div>

      {o.status === "submitted" ? (
        <section className="flex flex-col gap-3">
          <h3 className="!m-0">How many can you fill?</h3>
          <p className="!m-0 text-sm text-(--color-neutral-700)">
            Set each line to what you can send. 0 declines it. Confirming takes the stock out and emails the customer.
          </p>
          <ConfirmForm orderId={o.id} lines={confirmLines} unit={wholesale ? "cases" : "packs"} />
        </section>
      ) : (
        <table className="table">
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className={l.status === "declined" ? "text-(--color-neutral-700)" : ""}>
                <td>
                  {l.product_name} · {l.option_label}
                </td>
                <td className="tabular-nums">
                  {l.status === "confirmed" ? l.requested_qty : `${l.confirmed_qty ?? 0} of ${l.requested_qty}`} × {money(l.unit_price)}
                </td>
                <td className="font-semibold text-(--color-accent-900)">{l.status === "confirmed" ? "" : l.status}</td>
                <td className="text-right tabular-nums">{money((l.confirmed_qty ?? 0) * l.unit_price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex flex-col items-end gap-0.5 text-right">
        {Number(o.discount_amount) > 0 && (
          <div>
            Discount{o.discount_kind === "percent" && ` ${o.discount_value}%`} −{money(o.discount_amount)}
          </div>
        )}
        {Number(o.card_fee) > 0 && (
          <div>
            Card fee {o.card_fee_percent}% {money(o.card_fee)}
          </div>
        )}
        <div className="text-xl font-semibold">
          {o.status === "submitted" ? "Estimated total" : "Total"} {money(o.total)}
        </div>
        {paid > 0 && (
          <div className="text-(--color-neutral-700)">
            Paid {formatCents(paid)} · {o.payment_status}
          </div>
        )}
      </div>

      {o.cancel_reason && <Notice ok={false}>Cancelled: {o.cancel_reason}</Notice>}
      {overpaid > 0 && o.status !== "submitted" && (
        <Notice ok={false} action={<RefundForm orderId={o.id} />}>
          They paid {formatCents(overpaid)} more online than the order now comes to.
        </Notice>
      )}

      {o.payments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="!m-0">Payments</h3>
          <ul className="!m-0 list-none !p-0 text-sm">
            {o.payments.map((p) => (
              <li key={p.id}>
                {time.format(new Date(p.received_at))} · {p.square_refund_id ? "Card refund" : paymentName(p.method)} {money(p.amount)}
                {p.reference && ` · ${p.reference}`}
              </li>
            ))}
          </ul>
        </section>
      )}

      {open && (
        <div className="grid gap-4 md:grid-cols-2">
          {o.payment_status !== "paid" && (
            <Card className="flex flex-col gap-3">
              <h3 className="!m-0">Take payment</h3>
              <PaymentForm orderId={o.id} balanceCents={Math.max(toCents(o.total) - paid, 0)} defaultMethod={o.payment_method} />
            </Card>
          )}
          <Card className="flex flex-col gap-3">
            <h3 className="!m-0">{wholesale ? "Delivered" : "Picked up"}?</h3>
            <CompleteForm orderId={o.id} label={wholesale ? "Mark delivered" : "Mark picked up"} unpaid={o.payment_status !== "paid"} />
          </Card>
        </div>
      )}

      {(o.status === "submitted" || open) && <CancelForm orderId={o.id} hasPayments={handPaid !== 0} refundsCard={paid - handPaid > 0} />}
    </PageShell>
  );
}
