import Link from "next/link";
import { Badge, ButtonLink, Corners, Input, PageShell } from "@/components/ui";
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

  const label = "text-[11px] tracking-[.08em] uppercase text-(--color-neutral-700)";

  return (
    <PageShell lead={staff.can_edit_prices ? undefined : "You can view products. Only price managers can change them."}>
      <div className="flex flex-wrap gap-2.5">
        <form className="min-w-[200px] flex-1">
          <Input name="q" defaultValue={q} placeholder="Search by name or brand" />
        </form>
        {staff.can_edit_prices && (
          <>
            <ButtonLink variant="primary" href="/store/products/new" className="min-h-12">
              New product
            </ButtonLink>
            <ButtonLink href="/store/products/import" className="min-h-12">
              Import spreadsheet
            </ButtonLink>
          </>
        )}
      </div>
      {error && <p className="!m-0 font-semibold text-(--color-accent-900)">{error.message}</p>}
      {products && products.length === 0 && (
        <p className="!m-0 text-(--color-neutral-700)">{q ? "No products match." : "No products yet. Add one or import your spreadsheet."}</p>
      )}
      {products && products.length > 0 && (
        <>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))]">
            {products.map((p) => (
              <Link
                key={p.id}
                href={`/store/products/${p.id}`}
                className="blueprint flex flex-col gap-2.5 p-4 !text-(--color-text) !no-underline hover:bg-(--color-accent-100)"
              >
                <Corners />
                <div>
                  <div className="flex items-start gap-2">
                    <span className="flex-1 font-(family-name:--font-heading) text-[19px] font-semibold">{p.name}</span>
                    {!p.active && <Badge tone="warn">inactive</Badge>}
                  </div>
                  <div className="text-[13px] text-(--color-neutral-700)">
                    {[p.brand, p.category, `case of ${p.case_size}`].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[13px]">
                  {[
                    ["Cost", p.cost_per_case],
                    ["Wholesale", p.wholesale_case_price],
                    ["Party", p.party_case_price],
                  ].map(([name, v]) => (
                    <div key={name}>
                      <div className={label}>{name}</div>
                      <div className="font-semibold">{money(v as number | null)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...p.pack_sizes]
                    .sort((a, b) => a.units - b.units)
                    .map((s) => (
                      <span key={s.label} className="tag tag-neutral">
                        {s.label} {money(s.cash_price)} / {money(s.card_price)}
                      </span>
                    ))}
                  {p.pack_sizes.length === 0 && <span className="text-[13px] text-(--color-neutral-700)">No retail packs</span>}
                </div>
              </Link>
            ))}
          </div>
          <p className="!m-0 text-[13px] text-(--color-neutral-700)">Retail packs show cash / card price.</p>
        </>
      )}
    </PageShell>
  );
}
