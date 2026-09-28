import { requireStaff } from "@/lib/auth";
import { loadRegisterCatalog } from "@/lib/inventoryData";
import { OfflineReady } from "./OfflineReady";
import { Register } from "./Register";

export default async function RegisterPage() {
  const staff = await requireStaff();
  const catalog = await loadRegisterCatalog();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <OfflineReady />
      {catalog.length === 0 ? (
        <p className="opacity-70">No products with pack sizes yet. Add prices on the Products page first.</p>
      ) : (
        <Register catalog={catalog} staffId={staff.id} />
      )}
    </main>
  );
}
