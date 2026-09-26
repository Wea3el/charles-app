"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { done, fail, num, text, type ActionResult } from "@/lib/action";
import type { Enums } from "@/lib/database.types";

function refresh() {
  revalidatePath("/store/inventory", "layout");
  revalidatePath("/store/low-stock");
}

function wholeQty(v: number | null) {
  return v !== null && Number.isInteger(v) && v > 0;
}

async function names(productId: string, ...locationIds: string[]) {
  const supabase = await createClient();
  const [{ data: product }, { data: locs }] = await Promise.all([
    supabase.from("products").select("name, case_size").eq("id", productId).single(),
    supabase.from("locations").select("id, name, catalog").in("id", locationIds),
  ]);
  const loc = (id: string) => locs?.find((l) => l.id === id);
  return { product, loc };
}

const unit = (catalog: Enums<"catalog_kind"> | undefined, n: number) =>
  `${n} ${catalog === "retail" ? "single" : "case"}${n === 1 ? "" : "s"}`;

export async function receiveStock(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const productId = text(form, "product_id");
  const locationId = text(form, "location_id");
  const qty = num(form, "qty");
  if (!productId) return fail("Pick a product (scan it or search by name).");
  if (!locationId) return fail("Pick where it's going.");
  if (!wholeQty(qty)) return fail("Enter how many, as a whole number.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("inv_receive", {
    p_product: productId,
    p_location: locationId,
    p_qty: qty!,
    p_note: text(form, "note") ?? undefined,
  });
  if (error) return fail(error.message);
  const { product, loc } = await names(productId, locationId);
  refresh();
  return done(`Added ${unit(loc(locationId)?.catalog, qty!)} of ${product?.name} to ${loc(locationId)?.name}.`);
}

export async function restockFront(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const productId = text(form, "product_id");
  const from = text(form, "from_id");
  const to = text(form, "to_id");
  const cases = num(form, "qty");
  if (!productId) return fail("Pick a product (scan it or search by name).");
  if (!from || !to) return fail("Pick the warehouse spot and the front fridge.");
  if (!wholeQty(cases)) return fail("Enter how many cases, as a whole number.");
  const supabase = await createClient();
  const { data: singles, error } = await supabase.rpc("inv_restock", {
    p_product: productId,
    p_from: from,
    p_to: to,
    p_cases: cases!,
    p_note: text(form, "note") ?? undefined,
  });
  if (error) return fail(error.message);
  const { product, loc } = await names(productId, from, to);
  refresh();
  return done(`Moved ${unit("warehouse", cases!)} of ${product?.name} from ${loc(from)?.name} into ${loc(to)?.name} (${singles} singles).`);
}

export async function moveStock(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const productId = text(form, "product_id");
  const from = text(form, "from_id");
  const to = text(form, "to_id");
  const qty = num(form, "qty");
  if (!productId) return fail("Pick a product (scan it or search by name).");
  if (!from || !to) return fail("Pick where it's coming from and going to.");
  if (!wholeQty(qty)) return fail("Enter how many, as a whole number.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("inv_move", {
    p_product: productId,
    p_from: from,
    p_to: to,
    p_qty: qty!,
    p_note: text(form, "note") ?? undefined,
  });
  if (error) return fail(error.message);
  const { product, loc } = await names(productId, from, to);
  refresh();
  return done(`Moved ${unit(loc(from)?.catalog, qty!)} of ${product?.name} from ${loc(from)?.name} to ${loc(to)?.name}.`);
}

export async function countStock(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const productId = text(form, "product_id");
  const locationId = text(form, "location_id");
  const counted = num(form, "qty");
  if (!productId) return fail("Pick a product (scan it or search by name).");
  if (!locationId) return fail("Pick the spot you counted.");
  if (counted === null || !Number.isInteger(counted) || counted < 0) return fail("Enter the count as a whole number (0 or more).");
  const supabase = await createClient();
  const { data: diff, error } = await supabase.rpc("inv_count", {
    p_product: productId,
    p_location: locationId,
    p_counted: counted,
    p_note: text(form, "note") ?? undefined,
  });
  if (error) return fail(error.message);
  const { product, loc } = await names(productId, locationId);
  refresh();
  const change = diff === 0 ? "matches what the system had" : `${diff! > 0 ? "+" : ""}${diff} vs. the system`;
  return done(`${product?.name} in ${loc(locationId)?.name}: ${unit(loc(locationId)?.catalog, counted)} (${change}).`);
}
