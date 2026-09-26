import Link from "next/link";

export function Tile({ href, title, body }: { href: string; title: string; body: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-black/10 p-5 transition hover:border-black/30 hover:bg-black/[.03] dark:border-white/15 dark:hover:border-white/40 dark:hover:bg-white/[.05]"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm opacity-70">{body}</p>
    </Link>
  );
}

export function PageShell({ title, lead, children }: { title: string; lead?: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-bold">{title}</h1>
      {lead && <p className="mt-2 opacity-70">{lead}</p>}
      <div className="mt-8">{children}</div>
    </main>
  );
}
