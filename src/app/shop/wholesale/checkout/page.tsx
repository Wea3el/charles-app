import { loadShopCatalog } from "@/lib/shop";
import { Checkout } from "../../Checkout";
import { ShopShell } from "../../ShopShell";

export default async function WholesaleCheckout() {
  const { items, pricesVisible } = await loadShopCatalog("wholesale");
  return (
    <ShopShell kind="wholesale" signIn={!pricesVisible}>
      <Checkout kind="wholesale" items={items} pricesVisible={pricesVisible} />
    </ShopShell>
  );
}
