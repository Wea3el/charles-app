import { PageShell } from "@/components/Tile";

// Phase 3: front-fridge stock at retail prices, 21+ check at sign-up,
// ID check at pickup or delivery.
export default function RetailShop() {
  return (
    <PageShell
      title="Retail ordering"
      lead="You must be 21 or older to order. ID is checked at pickup or delivery."
    />
  );
}
