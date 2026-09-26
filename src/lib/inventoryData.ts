import { createClient } from "@/lib/supabase/server";
import type { BarcodeHit, Loc, Product, StockRow } from "@/lib/inventory";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Supabase returns at most 1000 rows per request; page through everything. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const size = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < size) return out;
  }
}

export async function loadLocations(supabase: Client): Promise<Loc[]> {
  const { data, error } = await supabase.from("locations").select("id, name, kind, catalog, sort_order").order("sort_order").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadInventory() {
  const supabase = await createClient();
  const [locations, products, stock, packs, extra] = await Promise.all([
    loadLocations(supabase),
    fetchAll<Product>((a, b) => supabase.from("products").select("id, name, brand, case_size, active").order("name").range(a, b)),
    fetchAll<StockRow>((a, b) => supabase.from("stock").select("location_id, product_id, quantity").gt("quantity", 0).range(a, b)),
    fetchAll<{ barcode: string | null; product_id: string; units: number }>((a, b) =>
      supabase.from("pack_sizes").select("barcode, product_id, units").not("barcode", "is", null).range(a, b),
    ),
    fetchAll<{ barcode: string; product_id: string; is_case: boolean }>((a, b) =>
      supabase.from("product_barcodes").select("barcode, product_id, is_case").range(a, b),
    ),
  ]);

  const caseSize = new Map(products.map((p) => [p.id, p.case_size]));
  const barcodes: BarcodeHit[] = [
    ...packs.map((p) => ({
      code: p.barcode!,
      product_id: p.product_id,
      units: p.units,
      isCase: p.units === caseSize.get(p.product_id),
    })),
    ...extra.map((b) => ({
      code: b.barcode,
      product_id: b.product_id,
      units: b.is_case ? (caseSize.get(b.product_id) ?? 1) : 1,
      isCase: b.is_case,
    })),
  ];

  return { locations, products, stock, barcodes };
}
