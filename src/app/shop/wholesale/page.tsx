import { loadShopCatalog } from "@/lib/shop";
import { ShopCatalog } from "../ShopCatalog";
import { ShopShell } from "../ShopShell";

// Phase 3 adds: sign-up (license + tax ID upload, awaits approval), placing
// orders, order status and stop number.
export default async function WholesaleShop() {
  const { items, pricesVisible } = await loadShopCatalog("wholesale");
  return (
    <ShopShell
      kind="wholesale"
      signIn={!pricesVisible}
      title="Wholesale ordering"
      lead={
        pricesVisible
          ? "Case prices for your account. Stock shows as In stock, Low or Out."
          : "Prices show once you sign in with an approved business account. Business accounts (liquor license and tax ID) open soon."
      }
    >
      <ShopCatalog kind="wholesale" items={items} pricesVisible={pricesVisible} />
    </ShopShell>
  );
}
