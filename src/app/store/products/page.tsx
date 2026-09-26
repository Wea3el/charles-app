import Link from "next/link";
import { PageShell } from "@/components/Tile";
import { Badge, Input } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const money = (v: number | null) => (v === null ? "—" : `$${Number(v).toFixed(2)}`);

export default async function ProductsPage(props: PageProps<"/store/products">) {
  const staff = await requireStaff();
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id, name, brand, category, case_size, cost_per_case, wholesale_case_price, party_case_price, active, pack_sizes(label, units, cash_price, card_price)")
    .order("name")
    .limit(500);
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,brand.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data: products, error } = await query;

  return (
    <PageShell title="Products" lead={staff.can_edit_prices ? undefined : "You can view products. Only price managers can change them."}>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form className="flex-1">
          <Input name="q" defaultValue={q} placeholder="Search by name or brand" />
        </form>
        {staff.can_edit_prices && (
          <>
            <Link href="/store/products/new" className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">
              New product
            </Link>
            <Link href="/store/products/import" className="rounded-lg border border-black/15 px-4 py-2 text-sm font-semibold dark:border-white/20">
              Import spreadsheet
            </Link>
          </>
        )}
      </div>
      {error && <p className="text-red-700">{error.message}</p>}
      {products && products.length === 0 && (
        <p className="opacity-70">{q ? "No products match." : "No products yet. Add one or import your spreadsheet."}</p>
      )}
      {products && products.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/10 dark:border-white/15">
              <tr>
                <th className="py-2 pr-4">Product</th>
                <th className="py-2 pr-4">Case</th>
                <th className="py-2 pr-4">Cost/case</th>
                <th className="py-2 pr-4">Wholesale</th>
                <th className="py-2 pr-4">Party</th>
                <th className="py-2 pr-4">Retail packs (cash / card)</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-black/5 align-top dark:border-white/10">
                  <td className="py-2 pr-4">
                    <Link href={`/store/products/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs opacity-60">{[p.brand, p.category].filter(Boolean).join(" · ")}</div>
                    {!p.active && <Badge tone="warn">inactive</Badge>}
                  </td>
                  <td className="py-2 pr-4">{p.case_size}</td>
                  <td className="py-2 pr-4">{money(p.cost_per_case)}</td>
                  <td className="py-2 pr-4">{money(p.wholesale_case_price)}</td>
                  <td className="py-2 pr-4">{money(p.party_case_price)}</td>
                  <td className="py-2 pr-4">
                    {[...p.pack_sizes]
                      .sort((a, b) => a.units - b.units)
                      .map((s) => `${s.label} ${money(s.cash_price)} / ${money(s.card_price)}`)
                      .join(" · ") || <span className="opacity-50">none</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
