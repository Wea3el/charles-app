"use client";

import { useEffect, useMemo, useState } from "react";
import { Stepper } from "@/components/ui";
import { formatCents } from "@/lib/pricing";
import type { ShopItem, ShopKind, ShopOption } from "@/lib/shop";

type Cart = Record<string, number>; // option id -> quantity

/** The cart, kept in this browser so it survives reloads and the trip to checkout. */
export function useCart(kind: ShopKind, items: ShopItem[], cardPrices = false) {
  const key = `shop.cart.${kind}`;
  const [cart, setCart] = useState<Cart>({});
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "{}");
      // Restoring a saved cart has to wait until the browser is running.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && typeof saved === "object") setCart(saved);
    } catch {}
  }, [key]);

  const setQty = (id: string, q: number) => {
    const next = { ...cart };
    if (q <= 0) delete next[id];
    else next[id] = q;
    setCart(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };

  const options = useMemo(() => {
    const m = new Map<string, { item: ShopItem; option: ShopOption }>();
    for (const item of items) for (const option of item.options) m.set(option.id, { item, option });
    return m;
  }, [items]);
  const price = (o: ShopOption) => (cardPrices ? (o.cardPriceCents ?? o.priceCents) : o.priceCents) ?? 0;
  const lines = Object.entries(cart)
    .filter(([id, q]) => q > 0 && options.has(id))
    .map(([id, q]) => {
      const l = options.get(id)!;
      return { ...l, quantity: q, totalCents: price(l.option) * q };
    });
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const unit = kind === "wholesale" ? "case" : "item";

  const clear = () => {
    setCart({});
    try {
      localStorage.removeItem(key);
    } catch {}
  };

  return {
    cart,
    setQty,
    clear,
    lines,
    count,
    totalCents: lines.reduce((n, l) => n + l.totalCents, 0),
    countText: `${count} ${unit}${count === 1 ? "" : "s"}`,
    anyFlag: lines.some((l) => l.item.availability !== "in_stock"),
  };
}

export type CartState = ReturnType<typeof useCart>;

export const FLAG_NOTE = "Items that are low or out may be partly filled or declined. We'll email you.";

/** One cart line with its stepper. `size` sm for the side panel, md for checkout. */
export function CartLines({ cart, pricesVisible, size }: { cart: CartState; pricesVisible: boolean; size: "sm" | "md" }) {
  const small = size === "sm";
  return (
    <>
      {cart.lines.map((l) => (
        <div
          key={l.option.id}
          className={`flex items-center gap-2.5 border-b border-(--color-divider) ${small ? "pb-2.5" : "py-2.5"}`}
        >
          <div className="min-w-0 flex-1">
            <div className={`font-semibold ${small ? "text-sm" : ""}`}>{l.item.name}</div>
            <div className={`${small ? "text-xs" : "text-[13px]"} text-(--color-neutral-700)`}>
              {l.option.label}
              {pricesVisible && ` · ${formatCents(l.totalCents)}`}
            </div>
            {l.item.availability !== "in_stock" && (
              <div className={`${small ? "text-xs" : "text-[13px]"} font-semibold text-(--color-accent-900)`}>
                {l.item.availability === "out" ? "Out right now" : "Running low"}
              </div>
            )}
          </div>
          <Stepper size={size} value={l.quantity} onChange={(q) => cart.setQty(l.option.id, q)} />
        </div>
      ))}
    </>
  );
}
