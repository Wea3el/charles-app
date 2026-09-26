"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { done, fail, text, type ActionResult } from "@/lib/action";
import type { Enums } from "@/lib/database.types";

import { MAX_PRICE_EDITORS } from "@/lib/constants";

async function priceEditorCount(excludeId?: string) {
  const supabase = await createClient();
  let q = supabase.from("staff").select("id", { count: "exact", head: true }).eq("can_edit_prices", true).eq("active", true);
  if (excludeId) q = q.neq("id", excludeId);
  const { count } = await q;
  return count ?? 0;
}

export async function addStaff(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireManager();
  const fullName = text(form, "full_name");
  const email = text(form, "email");
  const password = text(form, "password");
  const role = (text(form, "role") ?? "staff") as Enums<"staff_role">;
  const canEditPrices = form.get("can_edit_prices") === "on";
  if (!fullName || !email || !password) return fail("Name, email and a temporary password are required.");
  if (password.length < 8) return fail("Temporary password must be at least 8 characters.");
  if (canEditPrices && (await priceEditorCount()) >= MAX_PRICE_EDITORS) {
    return fail(`Only ${MAX_PRICE_EDITORS} people can change prices. Turn it off for someone else first.`);
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return fail((e as Error).message);
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) return fail(error?.message ?? "Could not create the login.");

  const supabase = await createClient();
  const { error: insertError } = await supabase
    .from("staff")
    .insert({ id: data.user.id, full_name: fullName, role, can_edit_prices: canEditPrices });
  if (insertError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return fail(insertError.message);
  }
  revalidatePath("/store/staff");
  return done(`${fullName} can now sign in with ${email} and the temporary password.`);
}

export async function updateStaff(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireManager();
  const id = text(form, "id");
  if (!id) return fail("Missing staff member.");
  const role = text(form, "role") as Enums<"staff_role"> | null;
  const canEditPrices = form.get("can_edit_prices") === "on";
  const active = form.get("active") === "on";

  if (id === me.id && (!active || role !== "manager")) {
    return fail("You can't remove your own manager access. Ask another manager.");
  }
  if (canEditPrices && active && (await priceEditorCount(id)) >= MAX_PRICE_EDITORS) {
    return fail(`Only ${MAX_PRICE_EDITORS} people can change prices. Turn it off for someone else first.`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff")
    .update({ role: role ?? "staff", can_edit_prices: canEditPrices, active })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/store/staff");
  return done("Saved.");
}
