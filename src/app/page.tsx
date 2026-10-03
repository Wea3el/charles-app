import Link from "next/link";
import { ShoppingCart, Truck } from "lucide-react";
import { Corners } from "@/components/ui";
import { ShopShell } from "./shop/ShopShell";

const choices = [
  { href: "/shop/wholesale", icon: Truck, title: "Wholesale", body: "Licensed businesses: wholesale pricing, delivery, order tracking." },
  { href: "/shop/retail", icon: ShoppingCart, title: "Retail", body: "Regular customers 21+: browse what's in the fridges and order." },
];

export default function Home() {
  return (
    <ShopShell>
      <div className="flex flex-col gap-1.5">
        <h1 className="!m-0 !text-[40px]">Welcome</h1>
        <p className="!m-0 text-[17px] text-(--color-neutral-700)">Are you ordering as a business or as a regular customer?</p>
      </div>
      <div className="grid max-w-[880px] gap-5 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        {choices.map(({ href, icon: Icon, title, body }) => (
          <Link
            key={href}
            href={href}
            className="blueprint flex min-h-[200px] flex-col items-start gap-4 p-6 !text-(--color-text) !no-underline hover:bg-(--color-accent-100)"
          >
            <Corners />
            <Icon size={36} strokeWidth={1.5} className="text-(--color-accent)" />
            <span className="flex flex-col gap-1.5">
              <span className="font-(family-name:--font-heading) text-[30px] leading-none font-semibold">{title}</span>
              <span className="text-[15px] text-(--color-neutral-700)">{body}</span>
            </span>
          </Link>
        ))}
      </div>
      <p className="!m-0 text-sm text-(--color-neutral-700)">
        Staff? <Link href="/store">Open the store app</Link>
      </p>
    </ShopShell>
  );
}
