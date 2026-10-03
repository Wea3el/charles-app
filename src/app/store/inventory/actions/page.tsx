import { requireStaff } from "@/lib/auth";
import { loadInventory } from "@/lib/inventoryData";
import { StockActions, type Tab } from "./StockActions";

const TABS: Tab[] = ["receive", "restock", "move", "count"];

export default async function StockActionsPage(props: PageProps<"/store/inventory/actions">) {
  await requireStaff();
  const params = await props.searchParams;
  const asked = params.task ?? params.tab;
  const tab = TABS.includes(asked as Tab) ? (asked as Tab) : "receive";
  const { locations, products, stock, barcodes } = await loadInventory();
  const active = products.filter((p) => p.active);
  const start = active.find((p) => p.id === params.product) ?? null;
  return <StockActions key={tab} tab={tab} locations={locations} products={active} stock={stock} barcodes={barcodes} initialProduct={start} />;
}
