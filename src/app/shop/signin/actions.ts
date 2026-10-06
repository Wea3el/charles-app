"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { done, fail, text, type ActionResult } from "@/lib/action";
import { siteUrl } from "@/lib/email";

/** Only send people back into the shop. */
const shopPath = (next: string | null, fallback: string) => (next && next.startsWith("/shop") && !next.startsWith("//") ? next : fallback);

export async function customerSignIn(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const email = text(form, "email");
  const password = text(form, "password");
  if (!email || !password) return fail("Enter your email and password.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return fail(error?.code === "email_not_confirmed" ? "Confirm your email first. Check your inbox for the link." : "Wrong email or password.");
  }

  const [{ data: customer }, { data: staff }] = await Promise.all([
    supabase.from("customers").select("kind").eq("auth_user_id", data.user.id).maybeSingle(),
    supabase.from("staff").select("id").eq("id", data.user.id).maybeSingle(),
  ]);
  if (!customer && !staff) {
    await supabase.auth.signOut();
    return fail("There's no customer account for this login. Create one below.");
  }
  redirect(shopPath(text(form, "next"), customer ? `/shop/${customer.kind}` : "/shop/wholesale"));
}

export async function customerSignUp(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const kind = text(form, "kind");
  const email = text(form, "email");
  const password = text(form, "password");
  const contactName = text(form, "contact_name");
  const phone = text(form, "phone");
  if (kind !== "wholesale" && kind !== "retail") return fail("Pick Wholesale or Retail.");
  if (!contactName || !email || !phone) return fail("Your name, email and phone are required.");
  if (!password || password.length < 8) return fail("Pick a password of at least 8 characters.");

  const meta: Record<string, string | null> = { customer_kind: kind, contact_name: contactName, phone };
  if (kind === "retail") {
    if (form.get("age_21") !== "on") return fail("You must be 21 or older to order.");
  } else {
    const fields = ["business_name", "address_line", "city", "state", "postal_code", "liquor_license_no", "license_expires_on", "tax_id"];
    for (const f of fields) meta[f] = text(form, f);
    if (!meta.business_name || !meta.address_line || !meta.city || !meta.liquor_license_no || !meta.tax_id) {
      return fail("Business name, address, liquor license number and tax ID are required.");
    }
    if (meta.license_expires_on && !/^\d{4}-\d{2}-\d{2}$/.test(meta.license_expires_on)) return fail("Check the license expiry date.");
  }

  const supabase = await createClient();
  const next = shopPath(text(form, "next"), kind === "wholesale" ? "/shop/account" : "/shop/retail");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta, emailRedirectTo: `${await siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) {
    if (error.code === "user_already_exists") return fail("That email already has an account. Sign in instead.");
    if (error.code === "signup_disabled") return fail("Online sign-up isn't open yet. Call the store.");
    return fail(error.message);
  }
  // With email confirmation on, there's no session until they click the link.
  if (data.session) redirect(next);
  return done(`Almost done: we sent a link to ${email}. Click it to confirm your email, then you're signed in.`);
}

export async function customerSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
