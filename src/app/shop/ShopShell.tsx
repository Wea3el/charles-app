import Link from "next/link";
import type { ReactNode } from "react";
import { Button, ButtonLink, PageShell } from "@/components/ui";
import { getShopViewer } from "@/lib/auth";
import type { ShopKind } from "@/lib/shop";
import { customerSignOut } from "./signin/actions";

const TABS: { kind: ShopKind; label: string }[] = [
  { kind: "wholesale", label: "Wholesale" },
  { kind: "retail", label: "Retail" },
];

/** Website header and page frame. `kind` shows the Wholesale | Retail tabs. */
export async function ShopShell({
  kind,
  title,
  lead,
  children,
}: {
  kind?: ShopKind;
  title?: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  const { customer, staff } = await getShopViewer();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex min-h-[60px] flex-wrap items-center gap-x-4 gap-y-1 border-b border-(--color-divider) px-5 py-2.5">
        <Link href="/" className="font-(family-name:--font-heading) text-[22px] font-semibold !text-(--color-text) !no-underline">
          Charles
        </Link>
        {kind && (
          <nav className="flex gap-0.5">
            {TABS.map((t) => (
              <Link
                key={t.kind}
                href={`/shop/${t.kind}`}
                aria-current={t.kind === kind ? "page" : undefined}
                className={`flex min-h-11 items-center border-b-2 px-2.5 font-medium !no-underline ${
                  t.kind === kind ? "border-(--color-accent) !text-(--color-accent-800)" : "border-transparent !text-(--color-neutral-700)"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-2 text-[13px] text-(--color-neutral-700)">
          {customer ? (
            <>
              <span>{customer.business_name ?? customer.contact_name}</span>
              <ButtonLink href="/shop/account" className="!min-h-10 text-[13px]">
                My orders
              </ButtonLink>
              <form action={customerSignOut}>
                <Button variant="ghost">Sign out</Button>
              </form>
            </>
          ) : staff ? (
            <ButtonLink href="/store" className="!min-h-10 text-[13px]">
              Store app
            </ButtonLink>
          ) : (
            <ButtonLink href={`/shop/signin?kind=${kind ?? "wholesale"}`} className="!min-h-10 text-[13px]">
              Sign in
            </ButtonLink>
          )}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-6 px-5 pt-7 pb-10">
        <PageShell title={title} lead={lead}>
          {children}
        </PageShell>
      </main>
    </div>
  );
}
