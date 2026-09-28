import { createClient } from "@/lib/supabase/server";
import { toCents } from "@/lib/register";

export type ShopKind = "wholesale" | "retail";
export type Availability = "in_stock" | "low" | "out";

/** Something a customer can put in the cart: a case (wholesale) or a pack (retail). */
export interface ShopOption {
  id: string;
  label: string;
  priceCents: number | null; // null: sign in to see
  cardPriceCents?: number;
}

export interface ShopItem {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  availability: Availability;
  options: ShopOption[];
  partyCasePriceCents: number | null;
}

interface PackJson {
  id: string;
  label: string;
  units: number;
  cash_price: number;
  card_price: number;
}

/** What the shop pages show. Works signed out; prices follow shop_catalog()'s rules. */
export async function loadShopCatalog(kind: ShopKind): Promise<{ items: ShopItem[]; pricesVisible: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shop_catalog", { p_kind: kind });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const items = rows.map((r): ShopItem => ({
    id: r.product_id,
    name: r.name,
    brand: r.brand,
    category: r.category,
    availability: r.availability as Availability,
    partyCasePriceCents: r.party_case_price === null ? null : toCents(r.party_case_price),
    options:
      kind === "wholesale"
        ? [{ id: r.product_id, label: `Case of ${r.case_size}`, priceCents: r.case_price === null ? null : toCents(r.case_price) }]
        : ((r.packs as unknown as PackJson[] | null) ?? []).map((p) => ({
            id: p.id,
            label: p.label,
            priceCents: toCents(p.cash_price),
            cardPriceCents: toCents(p.card_price),
          })),
  }));
  return { items, pricesVisible: kind === "retail" || rows.some((r) => r.prices_visible) };
}
