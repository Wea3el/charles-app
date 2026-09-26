"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { done, fail, num, text, type ActionResult } from "@/lib/action";
import { parseProductCsv } from "@/lib/productImport";

const PRICE_ONLY = "Only the managers who can change prices can edit products.";

function badMoney(...values: (number | null)[]) {
  return values.some((v) => v !== null && (!Number.isFinite(v) || v < 0));
}

export async function saveProduct(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.can_edit_prices) return fail(PRICE_ONLY);

  const id = text(form, "id");
  const name = text(form, "name");
  const caseSize = num(form, "case_size");
  const cost = num(form, "cost_per_case");
  const wholesale = num(form, "wholesale_case_price");
  const party = num(form, "party_case_price");
  if (!name) return fail("Product name is required.");
  if (!caseSize || !Number.isInteger(caseSize) || caseSize <= 0) return fail("Case size must be a whole number above 0.");
  if (badMoney(cost, wholesale, party)) return fail("Prices must be numbers like 24.50.");

  const values = {
    name,
    brand: text(form, "brand"),
    category: text(form, "category"),
    case_size: caseSize,
    cost_per_case: cost,
    wholesale_case_price: wholesale,
    party_case_price: party,
    active: form.has("has_active") ? form.get("active") === "on" : true,
  };

  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("products").update(values).eq("id", id);
    if (error) return fail(error.message);
    revalidatePath(`/store/products/${id}`);
    revalidatePath("/store/products");
    return done("Product saved.");
  }
  const { data, error } = await supabase.from("products").insert(values).select("id").single();
  if (error) return fail(error.message);
  revalidatePath("/store/products");
  redirect(`/store/products/${data.id}`);
}

export async function savePack(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.can_edit_prices) return fail(PRICE_ONLY);
  const id = text(form, "id");
  const productId = text(form, "product_id");
  const label = text(form, "label");
  const units = num(form, "units");
  const cash = num(form, "cash_price");
  const card = num(form, "card_price");
  if (!productId || !label) return fail("Pack name is required.");
  if (!units || !Number.isInteger(units) || units <= 0) return fail("Singles per pack must be a whole number.");
  if (cash === null || card === null || badMoney(cash, card)) return fail("Enter both a cash and a card price.");

  const supabase = await createClient();
  const values = { product_id: productId, label, units, barcode: text(form, "barcode"), cash_price: cash, card_price: card };
  const { error } = id
    ? await supabase.from("pack_sizes").update(values).eq("id", id)
    : await supabase.from("pack_sizes").insert({ ...values, sort_order: units });
  if (error) {
    if (error.code === "23505") return fail("That barcode or pack size is already used.");
    return fail(error.message);
  }
  revalidatePath(`/store/products/${productId}`);
  return done(id ? "Pack saved." : "Pack added.");
}

export async function deletePack(form: FormData) {
  const staff = await requireStaff();
  if (!staff.can_edit_prices) return;
  const id = text(form, "id");
  const productId = text(form, "product_id");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("pack_sizes").delete().eq("id", id);
  revalidatePath(`/store/products/${productId}`);
}

export async function addBarcode(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const productId = text(form, "product_id");
  const barcode = text(form, "barcode");
  if (!productId || !barcode) return fail("Scan or type a barcode.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("product_barcodes")
    .insert({ product_id: productId, barcode, is_case: form.get("is_case") === "on" });
  if (error) return fail(error.code === "23505" ? "That barcode is already on a product." : error.message);
  revalidatePath(`/store/products/${productId}`);
  return done("Barcode added.");
}

export async function deleteBarcode(form: FormData) {
  await requireStaff();
  const barcode = text(form, "barcode");
  const productId = text(form, "product_id");
  if (!barcode) return;
  const supabase = await createClient();
  await supabase.from("product_barcodes").delete().eq("barcode", barcode);
  revalidatePath(`/store/products/${productId}`);
}

export async function saveThresholds(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const productId = text(form, "product_id");
  if (!productId) return fail("Missing product.");
  const supabase = await createClient();
  for (const catalog of ["retail", "warehouse"] as const) {
    const min = num(form, `${catalog}_min`);
    const target = num(form, `${catalog}_target`);
    if (min === null && target === null) {
      await supabase.from("stock_thresholds").delete().eq("product_id", productId).eq("catalog", catalog);
      continue;
    }
    const m = min ?? 0;
    const t = target ?? m;
    if (!Number.isInteger(m) || !Number.isInteger(t) || m < 0 || t < m) {
      return fail(`${catalog === "retail" ? "Front fridge" : "Warehouse"} refill level must be at least the low level.`);
    }
    const { error } = await supabase
      .from("stock_thresholds")
      .upsert({ product_id: productId, catalog, min_qty: m, target_qty: t });
    if (error) return fail(error.message);
  }
  revalidatePath(`/store/products/${productId}`);
  revalidatePath("/store/low-stock");
  return done("Low-stock levels saved.");
}

export async function importProducts(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  if (!staff.can_edit_prices) return fail(PRICE_ONLY);
  const csv = text(form, "csv");
  if (!csv) return fail("Choose a CSV file or paste its contents.");

  const { rows, errors } = parseProductCsv(csv);
  if (errors.length) {
    return fail(`Nothing was imported. Fix these and try again: ${errors.slice(0, 10).join(" ")}${errors.length > 10 ? ` (+${errors.length - 10} more)` : ""}`);
  }

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase.from("products").select("id, name");
  if (loadError) return fail(loadError.message);
  const byName = new Map((existing ?? []).map((p) => [p.name.toLowerCase(), p.id]));

  let created = 0;
  let updated = 0;
  const problems: string[] = [];

  for (const row of rows) {
    let productId = byName.get(row.product.name.toLowerCase());
    if (productId) {
      const { error } = await supabase.from("products").update(row.product).eq("id", productId);
      if (error) {
        problems.push(`Row ${row.line}: ${error.message}`);
        continue;
      }
      updated++;
    } else {
      const { data, error } = await supabase.from("products").insert(row.product).select("id").single();
      if (error || !data) {
        problems.push(`Row ${row.line}: ${error?.message ?? "could not create"}`);
        continue;
      }
      productId = data.id;
      byName.set(row.product.name.toLowerCase(), productId);
      created++;
    }

    if (row.packs.length) {
      const { error } = await supabase
        .from("pack_sizes")
        .upsert(row.packs.map((p) => ({ ...p, product_id: productId! })), { onConflict: "product_id,units" });
      if (error) problems.push(`Row ${row.line} packs: ${error.code === "23505" ? "a barcode is already used by another product" : error.message}`);
    }
    if (row.caseBarcode) {
      const { error } = await supabase
        .from("product_barcodes")
        .upsert({ barcode: row.caseBarcode, product_id: productId, is_case: true });
      if (error) problems.push(`Row ${row.line} case barcode: ${error.message}`);
    }
    if (row.thresholds.length) {
      const { error } = await supabase
        .from("stock_thresholds")
        .upsert(row.thresholds.map((t) => ({ ...t, product_id: productId! })));
      if (error) problems.push(`Row ${row.line} low-stock levels: ${error.message}`);
    }
  }

  revalidatePath("/store/products");
  revalidatePath("/store/low-stock");
  const summary = `Imported ${created} new and updated ${updated} existing products.`;
  return problems.length ? fail(`${summary} Some rows had problems: ${problems.join(" ")}`) : done(summary);
}
