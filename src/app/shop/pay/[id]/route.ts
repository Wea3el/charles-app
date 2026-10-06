import { NextResponse, type NextRequest } from "next/server";
import { startOnlinePayment } from "@/lib/payments";

// "Pay now" links (checkout, My orders, emails) land here and go on to
// Square's checkout page. The order id is the secret, so guests can use it too.
export async function GET(request: NextRequest, ctx: RouteContext<"/shop/pay/[id]">) {
  const { id } = await ctx.params;
  const paid = new URL(`/shop/paid?order=${encodeURIComponent(id)}`, request.url);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.redirect(new URL("/", request.url));
  try {
    const url = await startOnlinePayment(id);
    return NextResponse.redirect(url ?? paid);
  } catch (e) {
    console.error("[pay]", e);
    paid.searchParams.set("error", "1");
    return NextResponse.redirect(paid);
  }
}
