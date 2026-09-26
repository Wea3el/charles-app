import Link from "next/link";
import { PageShell } from "@/components/Tile";
import { requireStaff } from "@/lib/auth";
import { loadInventory } from "@/lib/inventoryData";
import { InventoryMap } from "./InventoryMap";

export default async function InventoryPage() {
  await requireStaff();
  const { locations, products, stock } = await loadInventory();
  return (
    <PageShell title="Inventory" lead="Tap a fridge or warehouse spot to see what's in it.">
      <div className="-mt-4 mb-6 flex flex-wrap gap-4 text-sm">
        <Link href="/store/inventory/actions" className="underline">
          Receive, restock, move or count
        </Link>
        <Link href="/store/inventory/locations" className="underline">
          Edit storage spots
        </Link>
      </div>
      <InventoryMap locations={locations} products={products} stock={stock} />
    </PageShell>
  );
}
