import { redirect } from "next/navigation";
import { PageShell } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { ImportForm } from "./ImportForm";

export default async function ImportPage() {
  const staff = await requireStaff();
  if (!staff.can_edit_prices) redirect("/store/products");
  return (
    <PageShell
      title="Import products"
      lead="One row per product. Products with the same name are updated; new names are added. Leave a pack's prices blank if you don't sell that size."
    >
      <p className="!m-0 text-sm">
        {/* A file download (route handler), so a plain link. */}
        <a href="/store/products/import/template" download className="underline">
          Download the spreadsheet template
        </a>{" "}
        (includes one example row to copy).
      </p>
      <ImportForm />
    </PageShell>
  );
}
