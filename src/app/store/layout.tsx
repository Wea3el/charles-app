import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

const links = [
  { href: "/store/inventory", label: "Inventory" },
  { href: "/store/inventory/actions", label: "Receive / Restock / Move" },
  { href: "/store/low-stock", label: "Low stock" },
  { href: "/store/products", label: "Products" },
  { href: "/store/inventory/history", label: "History" },
];

export default async function StoreLayout({ children }: LayoutProps<"/store">) {
  const staff = await requireStaff();
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-black/10 dark:border-white/15">
        <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
          <Link href="/store" className="font-bold">
            Store
          </Link>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="opacity-80 hover:opacity-100">
              {l.label}
            </Link>
          ))}
          {staff.role === "manager" && (
            <Link href="/store/staff" className="opacity-80 hover:opacity-100">
              Staff
            </Link>
          )}
          <span className="ml-auto opacity-60">{staff.full_name}</span>
          <form action={signOut}>
            <button className="underline opacity-80 hover:opacity-100">Sign out</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
