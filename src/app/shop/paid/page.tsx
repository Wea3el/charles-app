import { ButtonLink, Notice } from "@/components/ui";
import { syncOnlinePayment } from "@/lib/payments";
import { squareOnlineConfigured } from "@/lib/square";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCents } from "@/lib/pricing";
import { toCents } from "@/lib/register";
import { ShopShell } from "../ShopShell";

// Square sends the customer back here after paying. We ask Square directly
// whether the payment went through; the URL alone never marks anything paid.
export default async function PaidPage(props: PageProps<"/shop/paid">) {
  const params = await props.searchParams;
  const id = typeof params.order === "string" && /^[0-9a-f-]{36}$/i.test(params.order) ? params.order : null;
  if (!id || !squareOnlineConfigured()) {
    return (
      <ShopShell title="Payment">
        <Notice ok={false}>{id ? "Online payment isn't set up yet. Call the store." : "That payment link isn't right."}</Notice>
      </ShopShell>
    );
  }

  let paid = false;
  try {
    paid = await syncOnlinePayment(id);
  } catch (e) {
    console.error("[paid]", e);
  }
  const { data: o } = await createAdminClient()
    .from("orders")
    .select("order_number, customer_kind, total, status, payment_status, customers(auth_user_id)")
    .eq("id", id)
    .maybeSingle();
  if (!o) {
    return (
      <ShopShell title="Payment">
        <Notice ok={false}>Order not found.</Notice>
      </ShopShell>
    );
  }
  paid ||= o.payment_status === "paid";
  const kind = o.customer_kind;

  return (
    <ShopShell kind={kind} title={paid ? "Thanks, you're paid" : "Payment not finished"}>
      {params.error && !paid && <Notice ok={false}>We couldn&apos;t open the payment page. Try again in a minute, or call the store.</Notice>}
      {paid ? (
        <Notice ok>
          Payment received for order #{o.order_number}: {formatCents(toCents(o.total))}. We&apos;ll email you when the store confirms it. If anything is
          short, the difference goes back to your card.
        </Notice>
      ) : o.status === "cancelled" ? (
        <Notice ok={false}>Order #{o.order_number} was cancelled, so there&apos;s nothing to pay.</Notice>
      ) : (
        <>
          <p className="!m-0">
            We haven&apos;t received payment for order #{o.order_number} ({formatCents(toCents(o.total))}) yet. If you just paid, give it a minute and
            refresh this page.
          </p>
          <div>
            <ButtonLink variant="primary" href={`/shop/pay/${id}`}>
              Pay now
            </ButtonLink>
          </div>
        </>
      )}
      <div className="flex flex-wrap gap-2.5">
        {o.customers?.auth_user_id && <ButtonLink href="/shop/account">My orders</ButtonLink>}
        <ButtonLink href={`/shop/${kind}`}>Keep shopping</ButtonLink>
      </div>
    </ShopShell>
  );
}
