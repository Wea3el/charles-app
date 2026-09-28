/**
 * Register logic shared by the sale screen (unit tested): what a scanned
 * barcode means, how the cart grows, and the payload record_sale() expects.
 */
import { cartTotals, discountAmount, packPrice, type CartLine, type Discount, type PackSize, type PriceMode } from "./pricing.ts";

export interface RegisterPack extends PackSize {
  barcode: string | null;
}

export interface RegisterProduct {
  id: string;
  name: string;
  brand: string | null;
  case_size: number;
  active: boolean;
  packs: RegisterPack[]; // sorted by units
  barcodes: { code: string; isCase: boolean }[];
}

export const toCents = (dollars: number | string) => Math.round(Number(dollars) * 100);

export type ScanResult =
  | { product: RegisterProduct; pack: RegisterPack } // 12s, 24s and anything with its own barcode
  | { product: RegisterProduct; pack: null } // a single: ask Single / 4 pack / 6 pack
  | null;

export function resolveScan(products: RegisterProduct[], code: string): ScanResult {
  const c = code.trim();
  if (!c) return null;
  for (const product of products) {
    const pack = product.packs.find((p) => p.barcode === c);
    if (pack) return { product, pack };
  }
  for (const product of products) {
    const hit = product.barcodes.find((b) => b.code === c);
    if (!hit) continue;
    if (hit.isCase) {
      const casePack = product.packs.find((p) => p.units === product.case_size);
      if (casePack) return { product, pack: casePack };
    }
    // Only one way to sell it: no need to ask.
    if (product.packs.length === 1) return { product, pack: product.packs[0] };
    return { product, pack: null };
  }
  return null;
}

export interface RegisterLine extends CartLine {
  key: string;
  product: Pick<RegisterProduct, "id" | "name">;
  pack: RegisterPack;
}

/** Add one of a pack. Repeats of an undiscounted line stack instead of adding a new line. */
export function addToCart(lines: RegisterLine[], product: RegisterLine["product"], pack: RegisterPack, key: string): RegisterLine[] {
  const same = lines.find((l) => l.pack.id === pack.id && !l.discount);
  if (same) return lines.map((l) => (l === same ? { ...l, quantity: l.quantity + 1 } : l));
  return [...lines, { key, product, pack, quantity: 1 }];
}

/** Store a discount the way the database does: percent as the %, flat in dollars. */
function discountJson(d?: Discount) {
  if (!d) return null;
  return d.kind === "percent" ? { kind: "percent" as const, value: d.value } : { kind: "flat" as const, value: d.cents / 100 };
}

export interface RecordSalePayload {
  client_id: string;
  staff_id: string;
  price_mode: PriceMode;
  sold_at: string;
  recorded_offline: boolean;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  discount: ReturnType<typeof discountJson>;
  cash_tendered_cents: number | null;
  square_checkout_id: string | null;
  square_payment_id: string | null;
  lines: {
    pack_size_id: string;
    quantity: number;
    unit_price_cents: number;
    discount_cents: number;
    discount: ReturnType<typeof discountJson>;
  }[];
}

export function buildSale(
  lines: RegisterLine[],
  mode: PriceMode,
  orderDiscount: Discount | undefined,
  meta: {
    clientId: string;
    staffId: string;
    soldAt?: Date;
    offline?: boolean;
    cashTenderedCents?: number | null;
    squareCheckoutId?: string | null;
    squarePaymentId?: string | null;
  },
): RecordSalePayload {
  if (lines.length === 0) throw new Error("The sale has no items");
  const totals = cartTotals(lines, mode, orderDiscount);
  if (meta.cashTenderedCents != null && meta.cashTenderedCents < totals.totalCents) {
    throw new Error("Cash given is less than the total");
  }
  return {
    client_id: meta.clientId,
    staff_id: meta.staffId,
    price_mode: mode,
    sold_at: (meta.soldAt ?? new Date()).toISOString(),
    recorded_offline: meta.offline ?? false,
    subtotal_cents: totals.subtotalCents,
    discount_cents: totals.orderDiscountCents,
    total_cents: totals.totalCents,
    discount: totals.orderDiscountCents > 0 ? discountJson(orderDiscount) : null,
    cash_tendered_cents: meta.cashTenderedCents ?? null,
    square_checkout_id: meta.squareCheckoutId ?? null,
    square_payment_id: meta.squarePaymentId ?? null,
    lines: lines.map((l) => {
      const unit = packPrice(l.pack, mode);
      const off = discountAmount(unit * l.quantity, l.discount);
      return {
        pack_size_id: l.pack.id,
        quantity: l.quantity,
        unit_price_cents: unit,
        discount_cents: off,
        discount: off > 0 ? discountJson(l.discount) : null,
      };
    }),
  };
}

/** Quick cash buttons: exact, then the next few round bills above the total. */
export function cashSuggestions(totalCents: number): number[] {
  const out = new Set<number>([totalCents]);
  for (const bill of [500, 1000, 2000, 5000, 10000]) {
    const up = Math.ceil(totalCents / bill) * bill;
    if (up > totalCents) out.add(up);
  }
  return [...out].sort((a, b) => a - b).slice(0, 4);
}

/** Parse a discount typed at the register: "10%" or "2.50" (dollars). */
export function parseDiscount(input: string): Discount | undefined | "invalid" {
  const t = input.trim().replace(/^\$/, "");
  if (!t) return undefined;
  const pct = /^(\d+(?:\.\d+)?)\s*%$/.exec(t);
  if (pct) {
    const v = Number(pct[1]);
    return v > 0 && v <= 100 ? { kind: "percent", value: v } : "invalid";
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(t)) return "invalid";
  const cents = toCents(t);
  return cents > 0 ? { kind: "flat", cents } : "invalid";
}
