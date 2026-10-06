import { loadShopCatalog } from "@/lib/shop";
import { PlacedNotice } from "../PlacedNotice";
import { ShopCatalog } from "../ShopCatalog";
import { ShopShell } from "../ShopShell";
import { AgeGate } from "./AgeGate";

export default async function RetailShop(props: PageProps<"/shop/retail">) {
  const params = await props.searchParams;
  const { items } = await loadShopCatalog("retail");
  return (
    <ShopShell kind="retail" title="Retail ordering" lead="What's in the front fridges right now. Order ahead and pick up at the store. You must be 21 or older; ID is checked at pickup.">
      <PlacedNotice kind="retail" params={params} />
      <AgeGate>
        <ShopCatalog kind="retail" items={items} pricesVisible />
      </AgeGate>
    </ShopShell>
  );
}
