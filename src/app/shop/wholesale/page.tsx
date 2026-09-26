import { PageShell } from "@/components/Tile";

// Phase 3: sign-up (license + tax ID upload, awaits approval), catalog with
// In stock / Low / Out, ordering with 3 PM same-day cutoff, order status + stop number.
export default function WholesaleShop() {
  return (
    <PageShell
      title="Wholesale ordering"
      lead="Sign in with your approved business account to order. New customers can apply with their liquor license and tax ID."
    />
  );
}
