/** Pure helpers shared by the inventory screens (unit tested). */

export type Catalog = "retail" | "warehouse";

export interface Loc {
  id: string;
  name: string;
  kind: "commercial_fridge" | "industrial_fridge" | "warehouse_area";
  catalog: Catalog;
  sort_order: number;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  case_size: number;
  active: boolean;
}

export interface StockRow {
  location_id: string;
  product_id: string;
  quantity: number;
}

export interface BarcodeHit {
  code: string;
  product_id: string;
  /** Singles in what was scanned: 1 for a single, case_size for a case. */
  units: number;
  isCase: boolean;
}

export function normalize(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/** Every word typed must appear in the name or brand ("cor ext" finds "Corona Extra"). */
export function matchesQuery(p: Pick<Product, "name" | "brand">, query: string) {
  const words = normalize(query).split(" ").filter(Boolean);
  if (words.length === 0) return false;
  const hay = normalize(`${p.name} ${p.brand ?? ""}`);
  return words.every((w) => hay.includes(w));
}

export function searchProducts<T extends Product>(products: T[], query: string, limit = 8): T[] {
  const q = normalize(query);
  if (!q) return [];
  return products
    .filter((p) => matchesQuery(p, query))
    .sort((a, b) => {
      const aStarts = normalize(a.name).startsWith(q) ? 0 : 1;
      const bStarts = normalize(b.name).startsWith(q) ? 0 : 1;
      return aStarts - bStarts || Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

export function findBarcode(hits: BarcodeHit[], code: string): BarcodeHit | undefined {
  const c = code.trim();
  if (!c) return undefined;
  return hits.find((h) => h.code === c);
}

/** Quantity of one product at each location (only locations that have some). */
export function stockForProduct(stock: StockRow[], productId: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of stock) if (s.product_id === productId && s.quantity > 0) m.set(s.location_id, s.quantity);
  return m;
}

export interface LocationSummary {
  itemCount: number;
  totalUnits: number;
  matches: { product_id: string; quantity: number }[];
}

/** Per-location totals, plus which searched products are in each location. */
export function summarizeLocations(stock: StockRow[], matchingIds: Set<string> | null): Map<string, LocationSummary> {
  const m = new Map<string, LocationSummary>();
  for (const s of stock) {
    if (s.quantity <= 0) continue;
    const sum = m.get(s.location_id) ?? { itemCount: 0, totalUnits: 0, matches: [] };
    sum.itemCount += 1;
    sum.totalUnits += s.quantity;
    if (matchingIds?.has(s.product_id)) sum.matches.push({ product_id: s.product_id, quantity: s.quantity });
    m.set(s.location_id, sum);
  }
  return m;
}

export const KIND_LABEL: Record<Loc["kind"], string> = {
  commercial_fridge: "Front fridges",
  industrial_fridge: "Industrial fridges",
  warehouse_area: "Warehouse",
};

export function unitWord(catalog: Catalog, n: number) {
  return `${catalog === "retail" ? "single" : "case"}${n === 1 ? "" : "s"}`;
}
