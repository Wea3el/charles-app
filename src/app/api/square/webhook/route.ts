import { NextResponse, type NextRequest } from "next/server";
import { recordPaymentForSquareOrder } from "@/lib/payments";
import { verifyWebhookSignature } from "@/lib/square";

// Square calls this when a payment changes, so an order is marked paid even if
// the customer closes the tab before coming back. Set up in the Square
// developer dashboard: Webhooks > Subscriptions, event payment.updated, URL
// <site>/api/square/webhook. Its signature key goes in SQUARE_WEBHOOK_SIGNATURE_KEY.
export async function POST(request: NextRequest) {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key) return NextResponse.json({ error: "not set up" }, { status: 503 });
  const body = await request.text();
  // Must be exactly the URL saved in Square (proxies can change what request.url shows).
  const url = process.env.SQUARE_WEBHOOK_URL ?? `${request.nextUrl.origin}/api/square/webhook`;
  if (!verifyWebhookSignature(body, request.headers.get("x-square-hmacsha256-signature"), url, key)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  const event = JSON.parse(body);
  const payment = event?.data?.object?.payment;
  if (event?.type?.startsWith("payment.") && payment?.status === "COMPLETED" && payment.order_id) {
    try {
      await recordPaymentForSquareOrder(payment.order_id, payment.id, payment.amount_money.amount);
    } catch (e) {
      console.error("[square webhook]", e);
      return NextResponse.json({ error: "could not record" }, { status: 500 }); // Square retries
    }
  }
  return NextResponse.json({ ok: true });
}
