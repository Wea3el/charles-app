import { ButtonLink } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { loadInventory } from "@/lib/inventoryData";
import { InventoryMap } from "./InventoryMap";

export default async function InventoryPage() {
  await requireStaff();
  const { locations, products, stock } = await loadInventory();
  return (
    <>
      <InventoryMap locations={locations} products={products} stock={stock} />
      <div>
        <ButtonLink href="/store/inventory/locations">Edit storage spots</ButtonLink>
      </div>
    </>
  );
}
