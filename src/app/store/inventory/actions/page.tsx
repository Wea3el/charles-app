import { PageShell } from "@/components/Tile";
import { requireStaff } from "@/lib/auth";
import { loadInventory } from "@/lib/inventoryData";
import { StockActions, type Tab } from "./StockActions";

const TABS: Tab[] = ["receive", "restock", "move", "count"];

export default async function StockActionsPage(props: PageProps<"/store/inventory/actions">) {
  await requireStaff();
  const params = await props.searchParams;
  const tab = TABS.includes(params.tab as Tab) ? (params.tab as Tab) : "receive";
  const { locations, products, stock, barcodes } = await loadInventory();
  return (
    <PageShell title="Stock">
      <StockActions key={tab} tab={tab} locations={locations} products={products.filter((p) => p.active)} stock={stock} barcodes={barcodes} />
    </PageShell>
  );
}
