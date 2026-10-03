import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, ButtonLink, Corners, PageShell } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function Row({ id, name, children, right }: { id: string; name: string; children: ReactNode; right: ReactNode }) {
  return (
    <div className="blueprint flex items-center gap-3 p-3.5">
      <Corners />
      <div className="flex flex-1 flex-col gap-0.5">
        <Link href={`/store/products/${id}`} className="font-semibold !text-(--color-text) !no-underline hover:!underline">
          {name}
        </Link>
        {children}
      </div>
      {right}
    </div>
  );
}

function List({ title, unit, sub, empty, children }: { title: string; unit: string; sub: string; empty: string | false; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2.5">
        <h3 className="!m-0">{title}</h3>
        <Badge>{unit}</Badge>
      </div>
      <p className="!m-0 text-sm text-(--color-neutral-700)">{sub}</p>
      {empty ? <p className="!m-0 text-sm text-(--color-neutral-700)">{empty}</p> : children}
    </section>
  );
}

export default async function LowStockPage() {
  await requireStaff();
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("low_stock").select("*").order("product_name");
  const front = (rows ?? []).filter((r) => r.catalog === "retail");
  const warehouse = (rows ?? []).filter((r) => r.catalog === "warehouse");
  const muted = "text-[13px] text-(--color-neutral-700)";

  return (
    <PageShell lead="Items below their low-stock level. Set levels on each product's page.">
      {error && <p className="!m-0 font-semibold text-(--color-accent-900)">{error.message}</p>}
      <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <List title="Restock the front fridges" unit="singles" sub="Bring these from the warehouse." empty={front.length === 0 && "All front fridges are stocked."}>
          {front.map((r) => (
            <Row
              key={r.product_id}
              id={r.product_id!}
              name={r.product_name!}
              right={
                <ButtonLink variant="primary" href={`/store/inventory/actions?task=restock&product=${r.product_id}`} className="shrink-0">
                  Bring {r.cases_to_bring_front} case{r.cases_to_bring_front === 1 ? "" : "s"}
                </ButtonLink>
              }
            >
              <span className={muted}>
                Front: {r.on_hand} (low at {r.min_qty}) · {r.where_now ?? "none out front"}
              </span>
              {(r.warehouse_cases ?? 0) < (r.cases_to_bring_front ?? 0) && (
                <span className="text-[13px] font-semibold text-(--color-accent-900)">Only {r.warehouse_cases} cases in the warehouse</span>
              )}
            </Row>
          ))}
        </List>

        <List title="Reorder for the warehouse" unit="cases" sub="Order these from the supplier." empty={warehouse.length === 0 && "Warehouse levels are fine."}>
          {warehouse.map((r) => (
            <Row
              key={r.product_id}
              id={r.product_id!}
              name={r.product_name!}
              right={
                <div className="shrink-0 text-right">
                  <div className="font-(family-name:--font-heading) text-[22px] font-semibold">{r.refill_qty}</div>
                  <div className="text-xs text-(--color-neutral-700)">cases to order</div>
                </div>
              }
            >
              <span className={muted}>
                {r.on_hand} cases (low at {r.min_qty}) · {r.where_now ?? "none in the warehouse"}
              </span>
            </Row>
          ))}
        </List>
      </div>
    </PageShell>
  );
}
