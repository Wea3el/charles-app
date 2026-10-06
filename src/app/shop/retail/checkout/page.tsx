import { getShopViewer } from "@/lib/auth";
import { loadShopCatalog, loadShopSettings } from "@/lib/shop";
import { squareOnlineConfigured } from "@/lib/square";
import { Checkout } from "../../Checkout";
import { ShopShell } from "../../ShopShell";
import { AgeGate } from "../AgeGate";

export default async function RetailCheckout() {
  const [{ items }, settings, { customer }] = await Promise.all([loadShopCatalog("retail"), loadShopSettings(), getShopViewer()]);
  return (
    <ShopShell kind="retail">
      <AgeGate>
        <Checkout
          kind="retail"
          items={items}
          pricesVisible
          settings={settings}
          onlinePay={squareOnlineConfigured()}
          account={customer && { kind: customer.kind, status: customer.status }}
        />
      </AgeGate>
    </ShopShell>
  );
}
