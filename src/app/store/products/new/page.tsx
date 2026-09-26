import { redirect } from "next/navigation";
import { PageShell } from "@/components/Tile";
import { requireStaff } from "@/lib/auth";
import { ProductForm } from "../ProductForms";

export default async function NewProductPage() {
  const staff = await requireStaff();
  if (!staff.can_edit_prices) redirect("/store/products");
  return (
    <PageShell title="New product" lead="After creating it you can add pack sizes, barcodes and low-stock levels.">
      <ProductForm canEdit />
    </PageShell>
  );
}
