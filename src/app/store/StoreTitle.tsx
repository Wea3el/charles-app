"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft } from "lucide-react";

// Longest prefix first.
const TITLES: [string, string][] = [
  ["/store/inventory/actions", "Stock"],
  ["/store/inventory/history", "History"],
  ["/store/inventory/locations", "Storage spots"],
  ["/store/inventory", "Find an item"],
  ["/store/low-stock", "Low stock"],
  ["/store/products", "Products"],
  ["/store/register", "Register"],
  ["/store/sales", "Sales"],
  ["/store/staff", "Staff"],
];

const title = "mr-auto font-(family-name:--font-heading) text-[22px] font-semibold";

export function StoreTitle() {
  const path = usePathname();
  if (path === "/store") return <div className={title}>Store</div>;
  return (
    <>
      <Link href="/store" className="btn btn-secondary min-h-11 px-3.5 text-[15px]">
        <ChevronLeft size={18} strokeWidth={1.5} />
        Home
      </Link>
      <div className={title}>{TITLES.find(([p]) => path.startsWith(p))?.[1]}</div>
    </>
  );
}
