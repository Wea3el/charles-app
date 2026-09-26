import Link from "next/link";
import { PageShell } from "@/components/Tile";
import { Badge, Card } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function LowStockPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("low_stock").select("*").order("product_name");
  const front = (rows ?? []).filter((r) => r.catalog === "retail");
  const warehouse = (rows ?? []).filter((r) => r.catalog === "warehouse");

  return (
    <PageShell title="Low stock" lead="Items below their low-stock level. Set levels on each product's page.">
      {error && <p className="text-red-700">{error.message}</p>}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            Restock the front fridges <Badge tone="retail">singles</Badge>
          </h2>
          <p className="mb-3 text-sm opacity-70">Bring these from the warehouse.</p>
          {front.length === 0 ? (
            <p className="text-sm opacity-60">All front fridges are stocked.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="opacity-60">
                <tr>
                  <th className="py-1">Item and where it is</th>
                  <th className="py-1 text-right">Bring front</th>
                </tr>
              </thead>
              <tbody>
                {front.map((r) => (
                  <tr key={r.product_id} className="border-t border-black/5 align-top dark:border-white/10">
                    <td className="py-2 pr-3">
                      <Link href={`/store/products/${r.product_id}`} className="font-medium hover:underline">
                        {r.product_name}
                      </Link>
                      <div className="text-xs opacity-70">
                        Front: {r.on_hand} (low at {r.min_qty}) · {r.where_now ?? "none out front"}
                      </div>
                      {(r.warehouse_cases ?? 0) < (r.cases_to_bring_front ?? 0) && (
                        <div className="text-xs text-red-700 dark:text-red-300">Only {r.warehouse_cases} cases in the warehouse</div>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <div className="text-lg font-semibold">{r.cases_to_bring_front} cases</div>
                      <div className="text-xs opacity-70">{r.refill_qty} singles</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            Reorder for the warehouse <Badge tone="warehouse">cases</Badge>
          </h2>
          <p className="mb-3 text-sm opacity-70">Order these from the supplier.</p>
          {warehouse.length === 0 ? (
            <p className="text-sm opacity-60">Warehouse levels are fine.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="opacity-60">
                <tr>
                  <th className="py-1">Item and where it is</th>
                  <th className="py-1 text-right">Order</th>
                </tr>
              </thead>
              <tbody>
                {warehouse.map((r) => (
                  <tr key={r.product_id} className="border-t border-black/5 align-top dark:border-white/10">
                    <td className="py-2 pr-3">
                      <Link href={`/store/products/${r.product_id}`} className="font-medium hover:underline">
                        {r.product_name}
                      </Link>
                      <div className="text-xs opacity-70">
                        {r.on_hand} cases (low at {r.min_qty}) · {r.where_now ?? "none in the warehouse"}
                      </div>
                    </td>
                    <td className="py-2 text-right text-lg font-semibold">{r.refill_qty} cases</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </PageShell>
  );
}
