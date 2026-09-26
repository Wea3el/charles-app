import Link from "next/link";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/Tile";
import { Card, unitLabel } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Barcodes, PackRow, ProductForm, ThresholdsForm } from "../ProductForms";

export default async function ProductPage(props: PageProps<"/store/products/[id]">) {
  const staff = await requireStaff();
  const { id } = await props.params;
  const supabase = await createClient();

  const [{ data: product }, { data: packs }, { data: barcodes }, { data: thresholds }, { data: stock }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase.from("pack_sizes").select("*").eq("product_id", id).order("units"),
    supabase.from("product_barcodes").select("*").eq("product_id", id),
    supabase.from("stock_thresholds").select("*").eq("product_id", id),
    supabase.from("stock").select("quantity, locations(name, catalog, sort_order)").eq("product_id", id).gt("quantity", 0),
  ]);
  if (!product) notFound();

  const canEdit = staff.can_edit_prices;
  const sortedStock = [...(stock ?? [])].sort((a, b) => (a.locations?.sort_order ?? 0) - (b.locations?.sort_order ?? 0));

  return (
    <PageShell title={product.name}>
      <p className="-mt-6 mb-6 text-sm">
        <Link href="/store/products" className="underline opacity-70">
          All products
        </Link>
      </p>
      <div className="space-y-6">
        <Card>
          <h2 className="mb-3 font-semibold">Details and case prices</h2>
          <ProductForm product={product} canEdit={canEdit} />
        </Card>

        <Card>
          <h2 className="font-semibold">Retail pack sizes</h2>
          <p className="mb-2 text-sm opacity-70">
            Scanning a single shows these options at the register. Hand-packed 4 and 6 packs don&apos;t need a barcode.
          </p>
          {(packs ?? []).map((p) => (
            <PackRow key={p.id} pack={p} productId={product.id} canEdit={canEdit} />
          ))}
          {canEdit && <PackRow productId={product.id} canEdit />}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-semibold">Other barcodes</h2>
            <Barcodes productId={product.id} barcodes={barcodes ?? []} />
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Where it is now</h2>
            {sortedStock.length === 0 ? (
              <p className="text-sm opacity-60">None in stock.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {sortedStock.map((s, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{s.locations?.name}</span>
                    <span className="font-medium">{unitLabel(s.locations?.catalog ?? "retail", s.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-semibold">Low-stock levels</h2>
          <ThresholdsForm
            productId={product.id}
            caseSize={product.case_size}
            retail={thresholds?.find((t) => t.catalog === "retail")}
            warehouse={thresholds?.find((t) => t.catalog === "warehouse")}
          />
        </Card>
      </div>
    </PageShell>
  );
}
