import { PageShell, Tile } from "@/components/Tile";

const sections = [
  { href: "/store/register", title: "Register", body: "Scan, pick pack size, cash/card, discounts, send to Square Terminal." },
  { href: "/store/inventory", title: "Inventory", body: "Fridge and warehouse map, search, restock the front, move stock." },
  { href: "/store/low-stock", title: "Low stock", body: "What to restock from the warehouse and what to reorder." },
  { href: "/store/orders", title: "Orders", body: "Today's wholesale and retail orders: confirm, partial fill, decline." },
  { href: "/store/customers", title: "Customers", body: "Profiles, documents, payments, in-store sign-up and approval." },
  { href: "/store/routes", title: "Delivery routes", body: "Trips, ice first, reorder stops until the driver leaves." },
  { href: "/store/dashboard", title: "Dashboard", body: "Today's retail revenue and profit." },
  { href: "/store/settings", title: "Prices & settings", body: "Managers only: prices, thresholds, staff, empties credit." },
];

export default function StoreHome() {
  return (
    <PageShell title="Store">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sections.map((s) => (
          <Tile key={s.href} {...s} />
        ))}
      </div>
    </PageShell>
  );
}
