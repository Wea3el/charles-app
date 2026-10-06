import { getShopViewer } from "@/lib/auth";
import { loadShopCatalog } from "@/lib/shop";
import { PlacedNotice } from "../PlacedNotice";
import { ShopCatalog } from "../ShopCatalog";
import { ShopShell } from "../ShopShell";

export default async function WholesaleShop(props: PageProps<"/shop/wholesale">) {
  const params = await props.searchParams;
  const [{ items, pricesVisible }, { customer }] = await Promise.all([loadShopCatalog("wholesale"), getShopViewer()]);
  const accountNote =
    customer?.kind === "retail"
      ? "You're signed in with a retail account. Business prices need a business account."
      : customer?.status === "pending"
        ? "Your business account is waiting for approval. We'll email you once it's approved."
        : customer && customer.status !== "approved"
          ? "This account can't order online right now. Call the store."
          : undefined;
  return (
    <ShopShell
      kind="wholesale"
      title="Wholesale ordering"
      lead={
        pricesVisible
          ? "Case prices for your account. Stock shows as In stock, Low or Out."
          : accountNote ?? "Prices show once you sign in with an approved business account. Apply with your liquor license and tax ID."
      }
    >
      <PlacedNotice kind="wholesale" params={params} />
      <ShopCatalog kind="wholesale" items={items} pricesVisible={pricesVisible} accountNote={accountNote} />
    </ShopShell>
  );
}
