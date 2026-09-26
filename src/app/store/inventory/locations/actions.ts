"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { done, fail, num, text, type ActionResult } from "@/lib/action";
import type { Enums } from "@/lib/database.types";

const KINDS: Enums<"location_kind">[] = ["commercial_fridge", "industrial_fridge", "warehouse_area"];

function parse(form: FormData) {
  const name = text(form, "name");
  const kind = text(form, "kind") as Enums<"location_kind"> | null;
  const catalog = text(form, "catalog") as Enums<"catalog_kind"> | null;
  return { name, kind, catalog };
}

function refresh() {
  revalidatePath("/store/inventory", "layout");
}

async function stockCount(locationId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("stock").select("quantity").eq("location_id", locationId).gt("quantity", 0);
  return (data ?? []).reduce((n, r) => n + r.quantity, 0);
}

export async function addLocation(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const { name, kind, catalog } = parse(form);
  if (!name || !kind || !KINDS.includes(kind)) return fail("Give the spot a name and type.");
  const supabase = await createClient();
  const { data: last } = await supabase.from("locations").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { error } = await supabase.from("locations").insert({
    name,
    kind,
    catalog: catalog ?? (kind === "commercial_fridge" ? "retail" : "warehouse"),
    sort_order: (last?.[0]?.sort_order ?? 0) + 1,
  });
  if (error) return fail(error.code === "23505" ? "A spot with that name already exists." : error.message);
  refresh();
  return done(`Added ${name}.`);
}

export async function updateLocation(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = text(form, "id");
  const { name, kind, catalog } = parse(form);
  const sortOrder = num(form, "sort_order");
  if (!id || !name || !kind || !catalog) return fail("Name, type and counting are required.");
  const supabase = await createClient();
  const { data: before } = await supabase.from("locations").select("catalog").eq("id", id).single();
  if (before && before.catalog !== catalog && (await stockCount(id)) > 0) {
    return fail("Empty this spot before switching between singles and cases.");
  }
  const { error } = await supabase
    .from("locations")
    .update({ name, kind, catalog, sort_order: Number.isFinite(sortOrder) && sortOrder !== null ? sortOrder : 0 })
    .eq("id", id);
  if (error) return fail(error.code === "23505" ? "A spot with that name already exists." : error.message);
  refresh();
  return done("Saved.");
}

export async function deleteLocation(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = text(form, "id");
  if (!id) return fail("Missing spot.");
  if ((await stockCount(id)) > 0) return fail("Move or count out the stock in this spot first.");
  const supabase = await createClient();
  const { count } = await supabase
    .from("stock_movements")
    .select("id", { count: "exact", head: true })
    .or(`from_location.eq.${id},to_location.eq.${id}`);
  if ((count ?? 0) > 0) return fail("This spot has stock history, so it can't be deleted. Rename it instead.");
  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error) return fail(error.message);
  refresh();
  return done("Deleted.");
}
