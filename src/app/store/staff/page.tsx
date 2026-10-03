import { PageShell } from "@/components/ui";
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
    <PageShell lead={`${editors} of ${MAX_PRICE_EDITORS} people can change prices.`}>
      <Card>
        <h2 className="!mt-0 !mb-3 !text-[20px]">Add a staff member</h2>
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
