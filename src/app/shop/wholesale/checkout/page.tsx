import { getShopViewer } from "@/lib/auth";
import { loadShopCatalog, loadShopSettings } from "@/lib/shop";
import { squareOnlineConfigured } from "@/lib/square";
import { Checkout } from "../../Checkout";
import { ShopShell } from "../../ShopShell";

export default async function WholesaleCheckout() {
  const [{ items, pricesVisible }, settings, { customer }] = await Promise.all([loadShopCatalog("wholesale"), loadShopSettings(), getShopViewer()]);
  return (
    <ShopShell kind="wholesale">
      <Checkout
        kind="wholesale"
        items={items}
        pricesVisible={pricesVisible}
        settings={settings}
        onlinePay={squareOnlineConfigured()}
        account={customer && { kind: customer.kind, status: customer.status }}
      />
    </ShopShell>
  );
}
