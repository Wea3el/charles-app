import { PageShell } from "@/components/ui";
import { Card } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadLocations } from "@/lib/inventoryData";
import { AddLocationForm, LocationRow } from "./LocationForms";

export default async function LocationsPage() {
  await requireStaff();
  const locations = await loadLocations(await createClient());
  return (
    <PageShell lead="Add each fridge and warehouse area so stock can be tracked where it really is.">
      <Card>
        <AddLocationForm />
      </Card>
      <div>
        {locations.map((l) => (
          <LocationRow key={l.id} loc={l} />
        ))}
      </div>
    </PageShell>
  );
}
