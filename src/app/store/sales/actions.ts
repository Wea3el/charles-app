"use server";

import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { done, fail, text, type ActionResult } from "@/lib/action";

export async function voidSale(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  await requireManager();
  const saleId = text(form, "sale_id");
  const reason = text(form, "reason");
  if (!saleId) return fail("Pick a sale.");
  if (!reason) return fail("Give a reason for the void.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_sale", { p_sale: saleId, p_reason: reason });
  if (error) return fail(error.message);
  revalidatePath("/store/sales");
  revalidatePath("/store/inventory", "layout");
  return done("Sale voided. The items are back in stock. Refund card payments in Square.");
}
