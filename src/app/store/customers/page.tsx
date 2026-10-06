import { Badge, Notice, PageShell } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DiscountForm, StatusButtons } from "./CustomerForms";

export default async function CustomersPage(props: PageProps<"/store/customers">) {
  await requireStaff();
  const params = await props.searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const supabase = await createClient();
  let query = supabase.from("customers").select("*").order("created_at", { ascending: false }).limit(200);
  if (q) {
    const like = `%${q.replace(/[%_,()]/g, " ")}%`;
    query = query.or(`business_name.ilike.${like},contact_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
  }
  const { data: customers, error } = await query;
  const pending = (customers ?? []).filter((c) => c.status === "pending");
  const rest = (customers ?? []).filter((c) => c.status !== "pending");

  const card = (c: NonNullable<typeof customers>[number]) => (
    <li key={c.id} className="flex flex-col gap-3 border border-(--color-divider) p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-lg font-semibold">{c.business_name ?? c.contact_name}</span>
        <Badge>{c.kind}</Badge>
        {!c.auth_user_id && !c.created_by_staff && <Badge>guest</Badge>}
        <Badge tone={c.status === "approved" ? "neutral" : "warn"}>{c.status}</Badge>
        <span className="ml-auto text-[13px] text-(--color-neutral-700)">Signed up {c.created_at.slice(0, 10)}</span>
      </div>
      <div className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        {c.business_name && <div>Contact: {c.contact_name}</div>}
        <div>
          {c.phone} {c.email && `· ${c.email}`}
        </div>
        {c.address_line && <div>{[c.address_line, c.city, c.state, c.postal_code].filter(Boolean).join(", ")}</div>}
        {c.kind === "wholesale" && (
          <>
            <div>
              Liquor license: <span className="font-semibold">{c.liquor_license_no ?? "—"}</span>
              {c.license_expires_on && ` (expires ${c.license_expires_on})`}
            </div>
            <div>
              Tax ID: <span className="font-semibold">{c.tax_id ?? "—"}</span>
            </div>
          </>
        )}
      </div>
      <StatusButtons id={c.id} status={c.status} />
      {c.kind === "wholesale" && c.status === "approved" && <DiscountForm id={c.id} kind={c.default_discount_kind} value={c.default_discount_value} />}
    </li>
  );

  return (
    <PageShell lead="Online accounts. Check a business's liquor license and tax ID before approving; until then they can't see prices or order.">
      <form>
        <SearchFieldForm q={q} />
      </form>
      {error && <Notice ok={false}>{error.message}</Notice>}
      <section className="flex flex-col gap-2.5">
        <h3 className="!m-0">Waiting for approval{pending.length > 0 && ` · ${pending.length}`}</h3>
        {pending.length === 0 ? <p className="!m-0 text-(--color-neutral-700)">No one waiting.</p> : <ul className="!m-0 flex list-none flex-col gap-3 !p-0">{pending.map(card)}</ul>}
      </section>
      <section className="flex flex-col gap-2.5">
        <h3 className="!m-0">Everyone else</h3>
        {rest.length === 0 ? <p className="!m-0 text-(--color-neutral-700)">No customers yet.</p> : <ul className="!m-0 flex list-none flex-col gap-3 !p-0">{rest.map(card)}</ul>}
      </section>
    </PageShell>
  );
}

/** Plain GET search, so it works without client code. */
function SearchFieldForm({ q }: { q: string }) {
  return (
    <label className="flex min-h-14 items-center gap-3 border border-(--color-divider) bg-(--color-surface) px-4">
      <input type="search" name="q" defaultValue={q} placeholder="Search name, business, email or phone" aria-label="Search customers" className="min-w-0 flex-1 bg-transparent text-lg outline-none" />
    </label>
  );
}
