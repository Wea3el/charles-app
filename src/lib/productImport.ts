/**
 * Product spreadsheet import: one row per product, with columns for each
 * pack size's prices. Pure functions so they can be unit tested.
 */

export const TEMPLATE_COLUMNS = [
  "name",
  "brand",
  "category",
  "case_size",
  "cost_per_case",
  "wholesale_case_price",
  "party_case_price",
  "single_barcode",
  "single_cash",
  "single_card",
  "4pack_cash",
  "4pack_card",
  "6pack_cash",
  "6pack_card",
  "12pack_barcode",
  "12pack_cash",
  "12pack_card",
  "case_barcode",
  "case_cash",
  "case_card",
  "retail_min",
  "retail_target",
  "warehouse_min",
  "warehouse_target",
] as const;

export interface ImportPack {
  label: string;
  units: number;
  barcode: string | null;
  cash_price: number;
  card_price: number;
  sort_order: number;
}

export interface ImportRow {
  line: number;
  product: {
    name: string;
    brand: string | null;
    category: string | null;
    case_size: number;
    cost_per_case: number | null;
    wholesale_case_price: number | null;
    party_case_price: number | null;
  };
  packs: ImportPack[];
  /** Case barcode when the case isn't sold at retail (no case price). */
  caseBarcode: string | null;
  thresholds: { catalog: "retail" | "warehouse"; min_qty: number; target_qty: number }[];
}

export interface ImportResult {
  rows: ImportRow[];
  errors: string[];
}

/** Minimal RFC 4180 CSV parser: quotes, escaped quotes, commas and newlines in quotes. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const text = input.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function money(raw: string | undefined): number | null | typeof NaN {
  if (raw === undefined) return null;
  const t = raw.trim().replace(/[$,]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}

function whole(raw: string | undefined): number | null | typeof NaN {
  if (raw === undefined) return null;
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isInteger(n) && n >= 0 ? n : NaN;
}

function clean(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  return t === "" ? null : t;
}

export function parseProductCsv(input: string): ImportResult {
  const table = parseCsv(input);
  const errors: string[] = [];
  const rows: ImportRow[] = [];
  if (table.length === 0) return { rows, errors: ["The file is empty."] };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  if (col("name") === -1) return { rows, errors: ['Missing a "name" column. Start from the template.'] };

  const seen = new Set<string>();

  table.slice(1).forEach((cells, i) => {
    const line = i + 2; // spreadsheet row number
    const get = (name: string) => (col(name) === -1 ? undefined : cells[col(name)]);
    const rowErrors: string[] = [];

    const name = clean(get("name"));
    if (!name) {
      errors.push(`Row ${line}: missing product name.`);
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      errors.push(`Row ${line}: "${name}" appears more than once.`);
      return;
    }
    seen.add(key);

    const caseSize = whole(get("case_size")) ?? 24;
    if (Number.isNaN(caseSize) || caseSize === 0) rowErrors.push("case_size must be a whole number above 0");

    const moneyField = (field: string) => {
      const v = money(get(field));
      if (Number.isNaN(v)) rowErrors.push(`${field} is not a valid price`);
      return Number.isNaN(v) ? null : v;
    };

    const packDefs = [
      { prefix: "single", label: "Single", units: 1, barcodeCol: "single_barcode" },
      { prefix: "4pack", label: "4 pack", units: 4, barcodeCol: null },
      { prefix: "6pack", label: "6 pack", units: 6, barcodeCol: null },
      { prefix: "12pack", label: "12 pack", units: 12, barcodeCol: "12pack_barcode" },
      { prefix: "case", label: `Case (${caseSize})`, units: caseSize as number, barcodeCol: "case_barcode" },
    ];

    const packs: ImportPack[] = [];
    let caseBarcode: string | null = null;
    packDefs.forEach((def, order) => {
      const cash = moneyField(`${def.prefix}_cash`);
      const card = moneyField(`${def.prefix}_card`);
      const barcode = def.barcodeCol ? clean(get(def.barcodeCol)) : null;
      if (cash === null && card === null) {
        if (def.prefix === "case") caseBarcode = barcode;
        else if (barcode) rowErrors.push(`${def.label} has a barcode but no prices`);
        return;
      }
      if (cash === null || card === null) {
        rowErrors.push(`${def.label} needs both a cash and a card price`);
        return;
      }
      if (packs.some((p) => p.units === def.units)) return; // e.g. case_size 12 duplicates the 12 pack
      packs.push({ label: def.label, units: def.units, barcode, cash_price: cash, card_price: card, sort_order: order });
    });

    const thresholds: ImportRow["thresholds"] = [];
    for (const catalog of ["retail", "warehouse"] as const) {
      const min = whole(get(`${catalog}_min`));
      const target = whole(get(`${catalog}_target`));
      if (Number.isNaN(min) || Number.isNaN(target)) {
        rowErrors.push(`${catalog} min/target must be whole numbers`);
      } else if (min !== null || target !== null) {
        const m = (min ?? 0) as number;
        const t = (target ?? m) as number;
        if (t < m) rowErrors.push(`${catalog}_target must be at least ${catalog}_min`);
        else thresholds.push({ catalog, min_qty: m, target_qty: t });
      }
    }

    const product = {
      name,
      brand: clean(get("brand")),
      category: clean(get("category")),
      case_size: caseSize as number,
      cost_per_case: moneyField("cost_per_case"),
      wholesale_case_price: moneyField("wholesale_case_price"),
      party_case_price: moneyField("party_case_price"),
    };

    if (rowErrors.length) {
      errors.push(`Row ${line} (${name}): ${rowErrors.join("; ")}.`);
      return;
    }
    rows.push({ line, product, packs, caseBarcode, thresholds });
  });

  return { rows, errors };
}

export function templateCsv(): string {
  const example = [
    "Corona Extra 12oz",
    "Corona",
    "Beer",
    "24",
    "28.50",
    "32.00",
    "34.00",
    "7501064191442",
    "2.50",
    "2.60",
    "9.00",
    "9.36",
    "13.00",
    "13.52",
    "",
    "24.00",
    "24.96",
    "7501064199998",
    "42.00",
    "43.68",
    "48",
    "96",
    "10",
    "30",
  ];
  return `${TEMPLATE_COLUMNS.join(",")}\n${example.join(",")}\n`;
}
