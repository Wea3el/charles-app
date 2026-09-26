import { test } from "node:test";
import assert from "node:assert/strict";
import { cartTotals, discountAmount, type PackSize } from "./pricing.ts";

const single: PackSize = { id: "s", label: "Single", units: 1, cashPriceCents: 300, cardPriceCents: 315 };
const sixPack: PackSize = { id: "6", label: "6 pack", units: 6, cashPriceCents: 1500, cardPriceCents: 1575 };

test("cash vs card flips every line", () => {
  const lines = [{ pack: sixPack, quantity: 1 }, { pack: single, quantity: 2 }];
  assert.equal(cartTotals(lines, "cash").totalCents, 2100);
  assert.equal(cartTotals(lines, "card").totalCents, 2205);
});

test("hand-packed 6-pack uses 6 singles of stock", () => {
  assert.equal(cartTotals([{ pack: sixPack, quantity: 2 }], "cash").singlesUsed, 12);
});

test("percent and flat discounts, never below zero", () => {
  assert.equal(discountAmount(1000, { kind: "percent", value: 10 }), 100);
  assert.equal(discountAmount(1000, { kind: "flat", cents: 250 }), 250);
  assert.equal(discountAmount(1000, { kind: "flat", cents: 5000 }), 1000);
});

test("line and whole-sale discounts stack", () => {
  const t = cartTotals(
    [{ pack: sixPack, quantity: 1, discount: { kind: "flat", cents: 100 } }],
    "cash",
    { kind: "percent", value: 10 },
  );
  assert.equal(t.subtotalCents, 1400);
  assert.equal(t.orderDiscountCents, 140);
  assert.equal(t.totalCents, 1260);
});
