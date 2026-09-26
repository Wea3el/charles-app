/**
 * Register pricing: pack sizes, cash vs card, and manual discounts.
 * All money is handled in cents to avoid floating-point rounding errors.
 */

export type PriceMode = "cash" | "card";

export interface PackSize {
  id: string;
  label: string; // "Single", "6 pack", ...
  units: number; // singles taken out of retail stock
  cashPriceCents: number;
  cardPriceCents: number;
}

export type Discount =
  | { kind: "percent"; value: number } // 10 = 10% off
  | { kind: "flat"; cents: number }; // 200 = $2.00 off

export interface CartLine {
  pack: PackSize;
  quantity: number;
  discount?: Discount;
}

export function packPrice(pack: PackSize, mode: PriceMode): number {
  return mode === "cash" ? pack.cashPriceCents : pack.cardPriceCents;
}

/** Amount taken off `amountCents`, never more than the amount itself. */
export function discountAmount(amountCents: number, discount?: Discount): number {
  if (!discount) return 0;
  const off =
    discount.kind === "percent"
      ? Math.round((amountCents * discount.value) / 100)
      : discount.cents;
  return Math.max(0, Math.min(off, amountCents));
}

export function lineTotal(line: CartLine, mode: PriceMode): number {
  const gross = packPrice(line.pack, mode) * line.quantity;
  return gross - discountAmount(gross, line.discount);
}

export interface CartTotals {
  subtotalCents: number;
  orderDiscountCents: number;
  totalCents: number;
  singlesUsed: number;
}

/** Totals for the whole sale. Switching `mode` flips every line to cash or card price. */
export function cartTotals(
  lines: CartLine[],
  mode: PriceMode,
  orderDiscount?: Discount,
): CartTotals {
  const subtotalCents = lines.reduce((sum, l) => sum + lineTotal(l, mode), 0);
  const orderDiscountCents = discountAmount(subtotalCents, orderDiscount);
  return {
    subtotalCents,
    orderDiscountCents,
    totalCents: subtotalCents - orderDiscountCents,
    singlesUsed: lines.reduce((n, l) => n + l.pack.units * l.quantity, 0),
  };
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}
