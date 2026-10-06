"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fail, text, type ActionResult } from "@/lib/action";

export async function signIn(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const email = text(form, "email");
  const password = text(form, "password");
  const next = text(form, "next");
  if (!email || !password) return fail("Enter your email and password.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return fail("Wrong email or password.");

  let { data: staff } = await supabase.from("staff").select("id, active").eq("id", data.user.id).maybeSingle();

  if (!staff) {
    // Very first login on a fresh system becomes the first manager.
    const name = text(form, "full_name") ?? email.split("@")[0];
    const { data: claimed } = await supabase.rpc("claim_first_manager", { p_full_name: name });
    if (claimed) {
      ({ data: staff } = await supabase.from("staff").select("id, active").eq("id", data.user.id).maybeSingle());
    }
  }

  if (!staff || !staff.active) {
    await supabase.auth.signOut();
    return fail("This login isn't set up as staff. Ask a manager to add you. Customers sign in on the ordering website.");
  }

  redirect(next && (next.startsWith("/store") || next.startsWith("/shop")) ? next : "/store");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
