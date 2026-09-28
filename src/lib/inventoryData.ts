import { createClient } from "@/lib/supabase/server";
import type { BarcodeHit, Loc, Product, StockRow } from "@/lib/inventory";
import { toCents, type RegisterProduct } from "@/lib/register";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Supabase returns at most 1000 rows per request; page through everything. */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
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

/** Everything the register needs to sell without the network: active products, packs, barcodes. */
export async function loadRegisterCatalog(): Promise<RegisterProduct[]> {
  const supabase = await createClient();
  const rows = await fetchAll((a, b) =>
    supabase
      .from("products")
      .select("id, name, brand, case_size, active, pack_sizes(id, label, units, barcode, cash_price, card_price), product_barcodes(barcode, is_case)")
      .eq("active", true)
      .order("name")
      .range(a, b),
  );
  return rows
    .map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      case_size: p.case_size,
      active: p.active,
      packs: p.pack_sizes
        .map((s) => ({
          id: s.id,
          label: s.label,
          units: s.units,
          barcode: s.barcode,
          cashPriceCents: toCents(s.cash_price),
          cardPriceCents: toCents(s.card_price),
        }))
        .sort((x, y) => x.units - y.units),
      barcodes: p.product_barcodes.map((b) => ({ code: b.barcode, isCase: b.is_case })),
    }))
    .filter((p) => p.packs.length > 0);
}
