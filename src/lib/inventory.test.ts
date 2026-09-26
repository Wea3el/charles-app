import { test } from "node:test";
import assert from "node:assert/strict";
import { findBarcode, matchesQuery, searchProducts, stockForProduct, summarizeLocations, type Product } from "./inventory.ts";

const products: Product[] = [
  { id: "1", name: "Corona Extra 12oz", brand: "Corona", case_size: 24, active: true },
  { id: "2", name: "Modelo Especial", brand: "Modelo", case_size: 24, active: true },
  { id: "3", name: "Corona Light", brand: "Corona", case_size: 24, active: false },
  { id: "4", name: "Bag of Ice 10lb", brand: null, case_size: 1, active: true },
];

test("search matches every word, name first, active first", () => {
  assert.equal(matchesQuery(products[0], "cor ext"), true);
  assert.equal(matchesQuery(products[1], "cor"), false);
  assert.deepEqual(searchProducts(products, "corona").map((p) => p.id), ["1", "3"]);
  assert.deepEqual(searchProducts(products, "ICE").map((p) => p.id), ["4"]);
  assert.deepEqual(searchProducts(products, "   "), []);
});

test("barcode lookup trims scanner whitespace", () => {
  const hits = [{ code: "123", product_id: "1", units: 1, isCase: false }];
  assert.equal(findBarcode(hits, " 123\n")?.product_id, "1");
  assert.equal(findBarcode(hits, "999"), undefined);
});

test("location summaries and search matches", () => {
  const stock = [
    { location_id: "A", product_id: "1", quantity: 40 },
    { location_id: "A", product_id: "2", quantity: 12 },
    { location_id: "B", product_id: "1", quantity: 7 },
    { location_id: "B", product_id: "2", quantity: 0 },
  ];
  const sum = summarizeLocations(stock, new Set(["1"]));
  assert.deepEqual(sum.get("A"), { itemCount: 2, totalUnits: 52, matches: [{ product_id: "1", quantity: 40 }] });
  assert.deepEqual(sum.get("B"), { itemCount: 1, totalUnits: 7, matches: [{ product_id: "1", quantity: 7 }] });
  assert.deepEqual([...stockForProduct(stock, "2")], [["A", 12]]);
});
