import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, PageShell } from "@/components/ui";
import type { ShopKind } from "@/lib/shop";

const TABS: { kind: ShopKind; label: string }[] = [
  { kind: "wholesale", label: "Wholesale" },
  { kind: "retail", label: "Retail" },
];

/** Website header and page frame. `kind` shows the Wholesale | Retail tabs. */
export function ShopShell({
  kind,
  signIn,
  title,
  lead,
  children,
}: {
  kind?: ShopKind;
  /** Show the Sign in button (signed-out wholesale). */
  signIn?: boolean;
  title?: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
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
        {signIn && (
          <ButtonLink href={`/login?next=/shop/${kind}`} className="ml-auto !min-h-10 text-[13px]">
            Sign in
          </ButtonLink>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col gap-6 px-5 pt-7 pb-10">
        <PageShell title={title} lead={lead}>
          {children}
        </PageShell>
      </main>
    </div>
  );
}
