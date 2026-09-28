import Link from "next/link";
import type { ReactNode } from "react";

export function ShopShell({ title, lead, children }: { title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-50">
        Preview: browse and build an order. Online checkout opens soon.
      </div>
      <header className="border-b border-black/10 dark:border-white/15">
        <nav className="mx-auto flex w-full max-w-6xl items-center gap-5 px-4 py-3 text-sm">
          <Link href="/" className="font-bold">
            Charles
          </Link>
          <Link href="/shop/wholesale" className="opacity-80 hover:opacity-100">
            Wholesale
          </Link>
          <Link href="/shop/retail" className="opacity-80 hover:opacity-100">
            Retail
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {lead && <div className="mt-2 opacity-70">{lead}</div>}
        <div className="mt-6">{children}</div>
      </main>
    </div>
  );
}
