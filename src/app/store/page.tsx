import Link from "next/link";
import { ArrowLeftRight, ArrowUpFromLine, ClipboardCheck, ClipboardList, Contact, History, PackagePlus, Receipt, ScanBarcode, Search, Tag, TriangleAlert, Users } from "lucide-react";
import { BigTile, ButtonLink } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const tasks = [
  { href: "/store/register", icon: ScanBarcode, title: "Register", body: "Ring up a sale" },
  { href: "/store/inventory/actions?task=receive", icon: PackagePlus, title: "Receive delivery", body: "A supplier delivery arrived" },
  { href: "/store/inventory/actions?task=restock", icon: ArrowUpFromLine, title: "Restock front", body: "Warehouse cases into a fridge" },
  { href: "/store/inventory/actions?task=move", icon: ArrowLeftRight, title: "Move stock", body: "Between two spots" },
  { href: "/store/inventory/actions?task=count", icon: ClipboardCheck, title: "Count a spot", body: "Fix the number by hand" },
];

export default async function StoreHome() {
  const staff = await requireStaff();
  const supabase = await createClient();
  const [{ count }, { count: newOrders }, { count: waiting }] = await Promise.all([
    supabase.from("low_stock").select("product_id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);

  const more = [
    { href: "/store/products", icon: Tag, label: "Products and prices" },
    { href: "/store/sales", icon: Receipt, label: "Sales" },
    { href: "/store/inventory/history", icon: History, label: "History" },
    ...(staff.role === "manager" ? [{ href: "/store/staff", icon: Users, label: "Staff" }] : []),
  ];

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h1 className="!m-0 !text-[36px]">What are you doing?</h1>
        <p className="!m-0 text-(--color-neutral-700)">Pick a task. Every screen has a Home button to come back here.</p>
      </div>
      <Link
        href="/store/inventory"
        className="flex min-h-14 items-center gap-3 border border-(--color-divider) bg-(--color-surface) px-4 text-[17px] !text-(--color-neutral-600) !no-underline hover:border-(--color-accent)"
      >
        <Search size={22} strokeWidth={1.5} className="text-(--color-accent)" />
        Where is it? Type a product or brand
      </Link>
      <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(155px,1fr))]">
        {tasks.map((t) => (
          <BigTile key={t.href} {...t} />
        ))}
        <BigTile
          href="/store/low-stock"
          icon={TriangleAlert}
          title="Low stock"
          body="Restock or reorder"
          badge={count ? `${count} item${count === 1 ? "" : "s"}` : undefined}
        />
        <BigTile href="/store/orders" icon={ClipboardList} title="Orders" body="Confirm and hand over" badge={newOrders ? `${newOrders} new` : undefined} />
        <BigTile
          href="/store/customers"
          icon={Contact}
          title="Customers"
          body="Approve business accounts"
          badge={waiting ? `${waiting} waiting` : undefined}
        />
      </div>
      <div className="flex flex-wrap gap-2.5">
        {more.map(({ href, icon: Icon, label }) => (
          <ButtonLink key={href} href={href}>
            <Icon size={18} strokeWidth={1.5} />
            {label}
          </ButtonLink>
        ))}
      </div>
    </>
  );
}
