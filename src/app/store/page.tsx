import { PageShell, Tile } from "@/components/Tile";

const ready = [
  { href: "/store/inventory", title: "Inventory", body: "Map of every fridge and warehouse spot. Search to see where an item is." },
  { href: "/store/inventory/actions", title: "Receive / Restock / Move", body: "Log deliveries, bring cases to the front fridges, move stock, count." },
  { href: "/store/low-stock", title: "Low stock", body: "What to restock from the warehouse and what to reorder." },
  { href: "/store/products", title: "Products", body: "Catalog, barcodes, pack sizes and prices. Import from a spreadsheet." },
  { href: "/store/inventory/history", title: "History", body: "Every stock change and who made it." },
];

const coming = ["Register (Phase 2)", "Daily dashboard (Phase 2)", "Orders and customers (Phase 3)", "Delivery routes (Phase 4)"];

export default function StoreHome() {
  return (
    <PageShell title="Store">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ready.map((s) => (
          <Tile key={s.href} {...s} />
        ))}
      </div>
      <p className="mt-8 text-sm opacity-60">Coming next: {coming.join(" · ")}</p>
    </PageShell>
  );
}
