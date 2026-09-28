import { test } from "node:test";
import assert from "node:assert/strict";
import { addToCart, buildSale, cashSuggestions, parseDiscount, resolveScan, type RegisterPack, type RegisterProduct } from "./register.ts";

const pack = (id: string, units: number, cash: number, card: number, barcode: string | null = null): RegisterPack => ({
  id, label: units === 1 ? "Single" : `${units} pack`, units, cashPriceCents: cash, cardPriceCents: card, barcode,
});
const single = pack("s", 1, 300, 315);
const six = pack("6", 6, 1500, 1575);
const twelve = pack("12", 12, 2600, 2730, "012-TWELVE");
const case24 = pack("24", 24, 4800, 5040);
const lager: RegisterProduct = {
  id: "lager", name: "Lager", brand: null, case_size: 24, active: true,
  packs: [single, six, twelve, case24],
  barcodes: [{ code: "SINGLE-CAN", isCase: false }, { code: "CASE-BOX", isCase: true }],
};
const ice: RegisterProduct = {
  id: "ice", name: "Ice 10lb", brand: null, case_size: 1, active: true,
  packs: [pack("ice1", 1, 299, 299)],
  barcodes: [{ code: "ICE", isCase: false }],
};

test("scanning a single asks for the pack; 12s and cases go straight in", () => {
  assert.deepEqual(resolveScan([lager, ice], "SINGLE-CAN"), { product: lager, pack: null });
  assert.equal(resolveScan([lager, ice], " 012-TWELVE ")?.pack, twelve);
  assert.equal(resolveScan([lager, ice], "CASE-BOX")?.pack, case24);
  assert.equal(resolveScan([lager, ice], "ICE")?.pack?.id, "ice1");
  assert.equal(resolveScan([lager, ice], "nope"), null);
  assert.equal(resolveScan([lager, ice], ""), null);
});

test("repeat scans stack unless the line has a discount", () => {
  let cart = addToCart([], lager, six, "a");
  cart = addToCart(cart, lager, six, "b");
  assert.equal(cart.length, 1);
  assert.equal(cart[0].quantity, 2);
  cart = [{ ...cart[0], discount: { kind: "flat", cents: 100 } }];
  cart = addToCart(cart, lager, six, "c");
  assert.equal(cart.length, 2);
});

test("buildSale matches the arithmetic record_sale checks", () => {
  const cart = [
    { key: "a", product: lager, pack: six, quantity: 2, discount: { kind: "flat" as const, cents: 100 } },
    { key: "b", product: lager, pack: single, quantity: 1 },
  ];
  const s = buildSale(cart, "cash", { kind: "percent", value: 10 }, { clientId: "c1", staffId: "me", cashTenderedCents: 5000 });
  const lineSum = s.lines.reduce((n, l) => n + l.unit_price_cents * l.quantity - l.discount_cents, 0);
  assert.equal(s.subtotal_cents, lineSum);
  assert.equal(s.subtotal_cents, 3000 - 100 + 300);
  assert.equal(s.discount_cents, 320);
  assert.equal(s.total_cents, s.subtotal_cents - s.discount_cents);
  assert.deepEqual(s.discount, { kind: "percent", value: 10 });
  assert.deepEqual(s.lines[0].discount, { kind: "flat", value: 1 });
  assert.equal(s.lines[1].discount, null);
  assert.equal(s.cash_tendered_cents, 5000);
});

test("card mode uses card prices on every line", () => {
  const s = buildSale([{ key: "a", product: lager, pack: six, quantity: 1 }], "card", undefined, { clientId: "c", staffId: "me" });
  assert.equal(s.total_cents, 1575);
  assert.equal(s.discount, null);
});

test("buildSale refuses an empty cart and short cash", () => {
  assert.throws(() => buildSale([], "cash", undefined, { clientId: "c", staffId: "me" }), /no items/);
  assert.throws(
    () => buildSale([{ key: "a", product: lager, pack: six, quantity: 1 }], "cash", undefined, { clientId: "c", staffId: "me", cashTenderedCents: 1000 }),
    /less than the total/,
  );
});

test("cash suggestions: exact, then round bills", () => {
  assert.deepEqual(cashSuggestions(1725), [1725, 2000, 5000, 10000]);
  assert.deepEqual(cashSuggestions(2000), [2000, 5000, 10000]);
});

test("discounts typed as 10% or 2.50", () => {
  assert.deepEqual(parseDiscount("10%"), { kind: "percent", value: 10 });
  assert.deepEqual(parseDiscount("$2.50"), { kind: "flat", cents: 250 });
  assert.equal(parseDiscount(""), undefined);
  assert.equal(parseDiscount("150%"), "invalid");
  assert.equal(parseDiscount("abc"), "invalid");
  assert.equal(parseDiscount("0"), "invalid");
});
