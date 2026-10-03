import { loadShopCatalog } from "@/lib/shop";
import { Checkout } from "../../Checkout";
import { ShopShell } from "../../ShopShell";
import { AgeGate } from "../AgeGate";

export default async function RetailCheckout() {
  const { items } = await loadShopCatalog("retail");
  return (
    <ShopShell kind="retail">
      <AgeGate>
        <Checkout kind="retail" items={items} pricesVisible />
      </AgeGate>
    </ShopShell>
  );
}
