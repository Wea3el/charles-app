import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, parseProductCsv, templateCsv } from "./productImport.ts";

test("parseCsv handles quotes, commas and CRLF", () => {
  const rows = parseCsv('name,brand\r\n"Bud Light, 16oz","A ""B"""\r\n\r\n');
  assert.deepEqual(rows, [["name", "brand"], ["Bud Light, 16oz", 'A "B"']]);
});

test("template example imports cleanly", () => {
  const { rows, errors } = parseProductCsv(templateCsv());
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.product.case_size, 24);
  assert.deepEqual(r.packs.map((p) => p.units), [1, 4, 6, 12, 24]);
  assert.equal(r.packs[0].barcode, "7501064191442");
  assert.equal(r.packs[4].barcode, "7501064199998");
  assert.deepEqual(r.thresholds, [
    { catalog: "retail", min_qty: 48, target_qty: 96 },
    { catalog: "warehouse", min_qty: 10, target_qty: 30 },
  ]);
});

test("case barcode without a case price is kept as a case barcode", () => {
  const csv = "name,case_size,single_cash,single_card,case_barcode\nIce 10lb,1,3.00,3.12,123\n";
  const { rows, errors } = parseProductCsv(csv);
  assert.deepEqual(errors, []);
  assert.equal(rows[0].caseBarcode, "123");
  assert.equal(rows[0].packs.length, 1);
});

test("reports missing card price, bad numbers and duplicates by row", () => {
  const csv = [
    "name,case_size,6pack_cash,6pack_card,cost_per_case",
    "A,24,12,,10",
    "B,abc,,,",
    "C,24,,,$1x",
    "A,24,,,",
    ",24,,,",
  ].join("\n");
  const { rows, errors } = parseProductCsv(csv);
  assert.equal(rows.length, 0);
  assert.equal(errors.length, 5);
  assert.match(errors[0], /Row 2 \(A\): 6 pack needs both a cash and a card price/);
  assert.match(errors[1], /Row 3 \(B\): case_size/);
  assert.match(errors[2], /Row 4 \(C\): cost_per_case is not a valid price/);
  assert.match(errors[3], /Row 5: "A" appears more than once/);
  assert.match(errors[4], /Row 6: missing product name/);
});
