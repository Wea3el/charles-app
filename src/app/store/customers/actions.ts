"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { done, fail, num, text, type ActionResult } from "@/lib/action";
import { sendEmail, siteUrl } from "@/lib/email";
import { accountApprovedEmail } from "@/lib/orders";
import type { Enums } from "@/lib/database.types";

const STATUSES: Enums<"account_status">[] = ["approved", "rejected", "suspended"];

export async function setCustomerStatus(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const staff = await requireStaff();
  const id = text(form, "id");
  const status = text(form, "status") as Enums<"account_status"> | null;
  if (!id) return fail("Pick a customer.");
  if (!status || !STATUSES.includes(status)) return fail("Pick approve, reject or suspend.");

  const supabase = await createClient();
  const { data: before } = await supabase.from("customers").select("status, kind, email, contact_name").eq("id", id).single();
  const { error } = await supabase
    .from("customers")
    .update(status === "approved" ? { status, approved_by: staff.id, approved_at: new Date().toISOString() } : { status })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/store/customers");
  revalidatePath("/store");

  if (status === "approved" && before?.kind === "wholesale" && before.status !== "approved") {
    const sent = await sendEmail(before.email, accountApprovedEmail(before.contact_name, `${await siteUrl()}/shop/wholesale`));
    return done(sent ? "Approved. They were emailed and can order now." : "Approved. They can order now. (Email isn't set up, so let them know.)");
  }
  return done(status === "approved" ? "Approved." : status === "rejected" ? "Rejected. They can't order online." : "Suspended. They can't order online until approved again.");
}

export async function setCustomerDiscount(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireStaff();
  const id = text(form, "id");
  const kind = text(form, "discount_kind");
  const value = num(form, "discount_value");
  if (!id) return fail("Pick a customer.");
  const none = !kind || kind === "none" || value === null || value === 0;
  if (!none) {
    if (kind !== "percent" && kind !== "flat") return fail("Pick % or $.");
    if (Number.isNaN(value) || value! < 0 || (kind === "percent" && value! > 100)) return fail("Check the discount amount.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update(none ? { default_discount_kind: null, default_discount_value: null } : { default_discount_kind: kind as "percent" | "flat", default_discount_value: value })
    .eq("id", id);
  if (error) return fail(error.message);
  revalidatePath("/store/customers");
  return done(none ? "Discount removed." : "Saved. It applies to their new orders.");
}
