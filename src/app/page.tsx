import { PageShell, Tile } from "@/components/Tile";

export default function Home() {
  return (
    <PageShell title="Welcome" lead="Are you ordering as a business or as a regular customer?">
      <div className="grid gap-4 sm:grid-cols-2">
        <Tile
          href="/shop/wholesale"
          title="Wholesale"
          body="Licensed businesses: wholesale pricing, delivery, order tracking."
        />
        <Tile
          href="/shop/retail"
          title="Retail"
          body="Regular customers 21+: browse what's in the fridges and order."
        />
      </div>
      <p className="mt-10 text-sm opacity-60">
        Staff? <a className="underline" href="/store">Open the store app</a>
      </p>
    </PageShell>
  );
}
