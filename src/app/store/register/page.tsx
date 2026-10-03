import { requireStaff } from "@/lib/auth";
import { loadRegisterCatalog } from "@/lib/inventoryData";
import { OfflineReady } from "./OfflineReady";
import { Register } from "./Register";

export default async function RegisterPage() {
  const staff = await requireStaff();
  const catalog = await loadRegisterCatalog();
  return (
    <>
      <OfflineReady />
      {catalog.length === 0 ? (
        <p className="!m-0 text-(--color-neutral-700)">No products with pack sizes yet. Add prices on the Products page first.</p>
      ) : (
        <Register catalog={catalog} staffId={staff.id} />
      )}
    </>
  );
}
