import { PageShell } from "@/components/Tile";
import { Card } from "@/components/ui";
import { requireManager } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddStaffForm, StaffRow } from "./StaffForms";
import { MAX_PRICE_EDITORS } from "@/lib/constants";

export default async function StaffPage() {
  await requireManager();
  const supabase = await createClient();
  const { data: staff } = await supabase.from("staff").select("*").order("full_name");
  const editors = (staff ?? []).filter((s) => s.active && s.can_edit_prices).length;

  return (
    <PageShell title="Staff" lead={`${editors} of ${MAX_PRICE_EDITORS} people can change prices.`}>
      <Card className="mb-8">
        <h2 className="mb-3 font-semibold">Add a staff member</h2>
        <AddStaffForm />
      </Card>
      <div>
        {(staff ?? []).map((p) => (
          <StaffRow key={p.id} person={p} />
        ))}
      </div>
    </PageShell>
  );
}
