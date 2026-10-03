import { loadShopCatalog } from "@/lib/shop";
import { ShopCatalog } from "../ShopCatalog";
import { ShopShell } from "../ShopShell";
import { AgeGate } from "./AgeGate";

// Phase 3 adds: customer accounts, placing orders, pickup/delivery choice.
export default async function RetailShop() {
  const { items } = await loadShopCatalog("retail");
  return (
    <ShopShell kind="retail" title="Retail ordering" lead="What's in the front fridges right now. You must be 21 or older to order; ID is checked at pickup or delivery.">
      <AgeGate>
        <ShopCatalog kind="retail" items={items} pricesVisible />
      </AgeGate>
    </ShopShell>
  );
}
