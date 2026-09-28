"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Field, Input } from "@/components/ui";
import { matchesQuery } from "@/lib/inventory";
import { formatCents } from "@/lib/pricing";
import type { Availability, ShopItem, ShopKind, ShopOption } from "@/lib/shop";

const AVAILABILITY: Record<Availability, { label: string; tone: "neutral" | "warn" | "warehouse" }> = {
  in_stock: { label: "In stock", tone: "neutral" },
  low: { label: "Low", tone: "warehouse" },
  out: { label: "Out", tone: "warn" },
};

type Cart = Record<string, number>; // option id -> quantity

function useCart(kind: ShopKind) {
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
  const update = (next: Cart) => {
    setCart(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {}
  };
  return [cart, update] as const;
}

/** Earliest day an online order can be for: tomorrow once it's past the same-day cutoff. */
function earliestDate(cutoffHour: number) {
  const now = new Date();
  const d = new Date(now);
  if (now.getHours() >= cutoffHour) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("en-CA");
}

export function ShopCatalog({
  kind,
  items,
  pricesVisible,
  cutoffHour = 15,
}: {
  kind: ShopKind;
  items: ShopItem[];
  pricesVisible: boolean;
  cutoffHour?: number;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [cart, setCart] = useCart(kind);
  const [date, setDate] = useState("");

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort(), [items]);
  const shown = items.filter(
    (i) =>
      (!query.trim() || matchesQuery(i, query)) &&
      (!category || i.category === category) &&
      (!inStockOnly || i.availability !== "out"),
  );

  const options = useMemo(() => {
    const m = new Map<string, { item: ShopItem; option: ShopOption }>();
    for (const item of items) for (const option of item.options) m.set(option.id, { item, option });
    return m;
  }, [items]);
  const cartLines = Object.entries(cart)
    .filter(([id, q]) => q > 0 && options.has(id))
    .map(([id, q]) => ({ ...options.get(id)!, quantity: q }));
  const cartTotal = cartLines.reduce((n, l) => n + (l.option.priceCents ?? 0) * l.quantity, 0);
  const cartCount = cartLines.reduce((n, l) => n + l.quantity, 0);
  const unit = kind === "wholesale" ? "case" : "item";

  const setQty = (id: string, q: number) => {
    const next = { ...cart };
    if (q <= 0) delete next[id];
    else next[id] = q;
    setCart(next);
  };

  const minDate = earliestDate(cutoffHour);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="!w-auto flex-1" aria-label="Search" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} /> In stock only
          </label>
        </div>
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {[null, ...categories].map((c) => (
              <button
                key={c ?? "all"}
                type="button"
                onClick={() => setCategory(c)}
                className={`rounded-full px-3 py-1 text-sm capitalize ${
                  category === c ? "bg-foreground text-background" : "border border-black/15 dark:border-white/20"
                }`}
              >
                {c ?? "All"}
              </button>
            ))}
          </div>
        )}

        {items.length === 0 && <p className="opacity-70">Nothing to show yet. Check back soon.</p>}
        {items.length > 0 && shown.length === 0 && <p className="opacity-70">Nothing matches.</p>}
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((item) => (
            <li key={item.id} className="flex flex-col rounded-xl border border-black/10 p-4 dark:border-white/15">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-xs capitalize opacity-60">{[item.brand, item.category].filter(Boolean).join(" · ")}</p>
                </div>
                <Badge tone={AVAILABILITY[item.availability].tone}>{AVAILABILITY[item.availability].label}</Badge>
              </div>
              <ul className="mt-3 space-y-2">
                {item.options.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      {o.label}
                      <span className="ml-2 font-semibold tabular-nums">
                        {o.priceCents === null ? <span className="font-normal opacity-60">sign in for price</span> : formatCents(o.priceCents)}
                      </span>
                      {o.cardPriceCents !== undefined && o.cardPriceCents !== o.priceCents && (
                        <span className="ml-1 text-xs opacity-60">({formatCents(o.cardPriceCents)} card)</span>
                      )}
                    </span>
                    {cart[o.id] ? (
                      <Stepper value={cart[o.id]} onChange={(q) => setQty(o.id, q)} />
                    ) : (
                      <Button variant="secondary" className="!px-3 !py-1" onClick={() => setQty(o.id, 1)}>
                        Add
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              {kind === "wholesale" && item.partyCasePriceCents !== null && (
                <p className="mt-2 text-xs opacity-60">Party price {formatCents(item.partyCasePriceCents)} / case</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <div className="rounded-xl border border-black/10 p-4 dark:border-white/15">
          <h2 className="font-semibold">
            Your order{cartCount > 0 && ` · ${cartCount} ${unit}${cartCount === 1 ? "" : "s"}`}
          </h2>
          {cartLines.length === 0 ? (
            <p className="mt-2 text-sm opacity-60">Nothing added yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {cartLines.map((l) => (
                <li key={l.option.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate">{l.item.name}</span>
                    <span className="text-xs opacity-60">
                      {l.option.label}
                      {l.item.availability === "out" && " · out right now"}
                    </span>
                  </span>
                  <Stepper value={l.quantity} onChange={(q) => setQty(l.option.id, q)} />
                </li>
              ))}
            </ul>
          )}
          {cartLines.length > 0 && pricesVisible && (
            <div className="mt-3 flex justify-between border-t border-black/10 pt-3 font-semibold dark:border-white/15">
              <span>Estimated total</span>
              <span className="tabular-nums">{formatCents(cartTotal)}</span>
            </div>
          )}
          {cartLines.some((l) => l.item.availability !== "in_stock") && (
            <p className="mt-2 text-xs opacity-70">Items that are low or out may be partly filled or declined. We&apos;ll email you.</p>
          )}
        </div>

        <div className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15">
          <Field
            label={kind === "wholesale" ? "Delivery date" : "Pickup date"}
            hint={`Same-day online orders close at ${cutoffHour > 12 ? cutoffHour - 12 : cutoffHour} ${cutoffHour >= 12 ? "PM" : "AM"}. After that, call the store.`}
          >
            <Input type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Button className="w-full" disabled>
            Place order
          </Button>
          <p className="text-xs opacity-70">Online ordering isn&apos;t open yet. Call the store to place this order.</p>
        </div>
      </aside>
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button variant="secondary" className="!px-2.5 !py-1" onClick={() => onChange(value - 1)} aria-label="One less">
        −
      </Button>
      <span className="w-7 text-center tabular-nums">{value}</span>
      <Button variant="secondary" className="!px-2.5 !py-1" onClick={() => onChange(value + 1)} aria-label="One more">
        +
      </Button>
    </span>
  );
}
