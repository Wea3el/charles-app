import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Staff = Tables<"staff">;

/** Current signed-in staff member, or null. */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("staff").select("*").eq("id", user.id).maybeSingle();
  return data && data.active ? data : null;
}

/** Use at the top of store pages and actions. Redirects if not active staff. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getStaff();
  if (!staff) redirect("/login?reason=not-staff");
  return staff;
}

export async function requireManager(): Promise<Staff> {
  const staff = await requireStaff();
  if (staff.role !== "manager") redirect("/store?reason=managers-only");
  return staff;
}
