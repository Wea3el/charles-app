import { PageShell } from "@/components/Tile";
import { Badge } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const KIND: Record<string, string> = {
  receive: "Received",
  restock: "Restocked front",
  move: "Moved",
  count: "Counted",
  sale: "Sold",
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
    <PageShell title="Stock history" lead="The last 200 changes, newest first.">
      {error && <p className="text-red-700">{error.message}</p>}
      {moves && moves.length === 0 && <p className="opacity-70">No stock changes yet.</p>}
      {moves && moves.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 dark:border-white/15">
              <tr>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">What</th>
                <th className="py-2 pr-3">Product</th>
                <th className="py-2 pr-3">Details</th>
                <th className="py-2 pr-3">Who</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => {
                let details = "";
                if (m.kind === "receive") details = `+${u(m.to?.catalog, m.quantity_in)} into ${m.to?.name}`;
                else if (m.kind === "count") details = `${m.to?.name}: ${u(m.to?.catalog, m.quantity_out)} → ${u(m.to?.catalog, m.quantity_in)}`;
                else details = `${u(m.from?.catalog, m.quantity_out)} from ${m.from?.name} → ${u(m.to?.catalog, m.quantity_in)} into ${m.to?.name}`;
                return (
                  <tr key={m.id} className="border-b border-black/5 align-top dark:border-white/10">
                    <td className="whitespace-nowrap py-2 pr-3 opacity-70">{fmt.format(new Date(m.created_at))}</td>
                    <td className="py-2 pr-3">
                      <Badge>{KIND[m.kind] ?? m.kind}</Badge>
                    </td>
                    <td className="py-2 pr-3 font-medium">{m.products?.name}</td>
                    <td className="py-2 pr-3">
                      {details}
                      {m.note && <div className="text-xs opacity-60">{m.note}</div>}
                    </td>
                    <td className="py-2 pr-3">{m.staff?.full_name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
