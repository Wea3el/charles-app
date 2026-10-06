import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Where the "confirm your email" link lands. Signs the customer in, then
// sends them on into the shop.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const nextParam = url.searchParams.get("next");
  const next = nextParam?.startsWith("/shop") && !nextParam.startsWith("//") ? nextParam : "/shop/account";
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  const to = url.clone();
  to.search = "";
  if (error) {
    to.pathname = "/shop/signin";
    to.searchParams.set("reason", "link");
  } else {
    to.pathname = next.split("?")[0];
  }
  return NextResponse.redirect(to);
}
