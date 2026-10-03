import { PageShell } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const KIND: Record<string, string> = {
  receive: "Received",
  restock: "Restocked front",
  move: "Moved",
  count: "Counted",
  sale: "Sold",
  sale_void: "Sale voided",
  order_pick: "Order",
  adjust: "Adjusted",
};

export default async function HistoryPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: moves, error } = await supabase
    .from("stock_movements")
    .select(
      "id, kind, quantity_in, quantity_out, note, created_at, products(name), from:locations!stock_movements_from_location_fkey(name, catalog), to:locations!stock_movements_to_location_fkey(name, catalog), staff(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const fmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "short", timeZone: "America/New_York" });
  const u = (catalog: string | undefined, n: number | null) =>
    n === null ? "" : `${n} ${catalog === "retail" ? "single" : "case"}${n === 1 ? "" : "s"}`;

  return (
    <PageShell lead="The last 200 changes, newest first.">
      {error && <p className="!m-0 font-semibold text-(--color-accent-900)">{error.message}</p>}
      {moves && moves.length === 0 && <p className="!m-0 text-(--color-neutral-700)">No stock changes yet.</p>}
      {moves && moves.length > 0 && (
        <div className="flex flex-col">
          {moves.map((m) => {
            let details = "";
            if (m.kind === "receive") details = `+${u(m.to?.catalog, m.quantity_in)} into ${m.to?.name}`;
            else if (m.kind === "count") details = `${m.to?.name}: ${u(m.to?.catalog, m.quantity_out)} → ${u(m.to?.catalog, m.quantity_in)}`;
            else details = `${u(m.from?.catalog, m.quantity_out)} from ${m.from?.name} → ${u(m.to?.catalog, m.quantity_in)} into ${m.to?.name}`;
            return (
              <div key={m.id} className="flex flex-wrap gap-x-4 gap-y-1 border-b border-(--color-divider) py-3.5">
                <span className="w-[130px] text-[13px] text-(--color-neutral-700)">{fmt.format(new Date(m.created_at))}</span>
                <span className="min-w-[200px] flex-1">
                  <strong className="font-semibold">{KIND[m.kind] ?? m.kind}</strong> {m.products?.name}
                  <span className="block text-[13px] text-(--color-neutral-700)">
                    {details}
                    {m.note && ` · ${m.note}`}
                  </span>
                </span>
                <span className="text-[13px]">{m.staff?.full_name}</span>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
