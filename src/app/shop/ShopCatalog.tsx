"use client";

import { useMemo, useState } from "react";
import { Button, ButtonLink, Corners, SearchField, Stepper } from "@/components/ui";
import { matchesQuery } from "@/lib/inventory";
import { formatCents } from "@/lib/pricing";
import type { Availability, ShopItem, ShopKind } from "@/lib/shop";
import { CartLines, FLAG_NOTE, useCart } from "./cart";

const AVAILABILITY: Record<Availability, { label: string; tag: string }> = {
  in_stock: { label: "In stock", tag: "tag-neutral" },
  low: { label: "Low", tag: "tag-accent" },
  out: { label: "Out", tag: "tag-outline" },
};

const SIGN_IN = "Sign in with an approved business account to see prices and order.";

export function ShopCatalog({ kind, items, pricesVisible }: { kind: ShopKind; items: ShopItem[]; pricesVisible: boolean }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const cart = useCart(kind, items);

  const categories = useMemo(() => [...new Set(items.map((i) => i.category).filter((c): c is string => !!c))].sort(), [items]);
  const shown = items.filter(
    (i) =>
      (!query.trim() || matchesQuery(i, query)) &&
      (!category || i.category === category) &&
      (!inStockOnly || i.availability !== "out"),
  );
  const needSignIn = kind === "wholesale" && !pricesVisible;
  const checkoutHref = `/shop/${kind}/checkout`;

  const chip = (active: boolean) =>
    `flex-none min-h-11 border px-3.5 text-sm font-medium ${
      active ? "border-(--color-accent) bg-(--color-accent) text-(--color-bg)" : "border-(--color-divider) hover:bg-(--color-accent-100)"
    }`;

  return (
    <>
      <div className="grid items-start gap-7 md:grid-cols-[minmax(0,1fr)_330px]">
        <section className="flex min-w-0 flex-col gap-3.5">
          <SearchField value={query} onChange={setQuery} placeholder="Search, e.g. corona" />
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            <button type="button" aria-pressed={inStockOnly} className={chip(inStockOnly)} onClick={() => setInStockOnly(!inStockOnly)}>
              In stock only
            </button>
            {categories.length > 1 &&
              categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  className={chip(category === c)}
                  onClick={() => setCategory(category === c ? null : c)}
                >
                  <span className="capitalize">{c}</span>
                </button>
              ))}
          </div>

          {items.length === 0 && <p className="!m-0 text-(--color-neutral-700)">Nothing to show yet. Check back soon.</p>}
          {items.length > 0 && shown.length === 0 && <p className="!m-0">Nothing matches.</p>}
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
            {shown.map((item) => (
              <article key={item.id} className="blueprint flex flex-col gap-2.5 p-4">
                <Corners />
                <div className="flex items-start gap-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="font-(family-name:--font-heading) text-xl leading-[1.15] font-semibold">{item.name}</div>
                    <div className="text-[13px] capitalize text-(--color-neutral-700)">{[item.brand, item.category].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className={`tag ${AVAILABILITY[item.availability].tag} flex-none !text-[13px]`}>{AVAILABILITY[item.availability].label}</span>
                </div>
                {item.options.map((o) => (
                  <div key={o.id} className="flex min-h-12 items-center gap-2.5 border-t border-(--color-divider) pt-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{o.label}</div>
                      <div className="flex flex-wrap items-baseline gap-x-1.5">
                        {o.priceCents === null ? (
                          <span className="text-sm text-(--color-neutral-700)">Sign in for price</span>
                        ) : (
                          <span className="text-[17px] font-semibold tabular-nums">{formatCents(o.priceCents)}</span>
                        )}
                        {o.cardPriceCents !== undefined && o.cardPriceCents !== o.priceCents && (
                          <span className="text-xs text-(--color-neutral-700)">{formatCents(o.cardPriceCents)} card</span>
                        )}
                      </div>
                    </div>
                    {cart.cart[o.id] ? (
                      <Stepper value={cart.cart[o.id]} onChange={(q) => cart.setQty(o.id, q)} />
                    ) : (
                      <Button variant="secondary" className="!px-[18px]" onClick={() => cart.setQty(o.id, 1)}>
                        Add
                      </Button>
                    )}
                  </div>
                ))}
                {kind === "wholesale" && item.partyCasePriceCents !== null && (
                  <div className="text-[13px] text-(--color-neutral-700)">Party price {formatCents(item.partyCasePriceCents)} / case</div>
                )}
              </article>
            ))}
          </div>
        </section>

        <aside className="blueprint sticky top-4 hidden flex-col gap-3 p-[18px] md:flex">
          <Corners />
          <h3 className="!m-0">Your order{cart.count > 0 && ` · ${cart.countText}`}</h3>
          {cart.lines.length === 0 && <p className="!m-0 text-sm text-(--color-neutral-700)">Nothing added yet. Tap Add on any item.</p>}
          <CartLines cart={cart} pricesVisible={pricesVisible} size="sm" />
          {cart.lines.length > 0 && pricesVisible && (
            <div className="flex justify-between text-[17px] font-semibold">
              <span>Estimated total</span>
              <span className="tabular-nums">{formatCents(cart.totalCents)}</span>
            </div>
          )}
          {cart.anyFlag && <p className="!m-0 text-[13px] text-(--color-neutral-700)">{FLAG_NOTE}</p>}
          {needSignIn ? (
            <>
              <p className="!m-0 text-sm">{SIGN_IN}</p>
              <ButtonLink href={`/login?next=/shop/wholesale`}>Sign in</ButtonLink>
              <Button variant="ghost" disabled title="Business accounts open soon">
                Apply for a business account
              </Button>
            </>
          ) : (
            cart.lines.length > 0 && (
              <ButtonLink variant="primary" href={checkoutHref} className="min-h-[52px] w-full !text-[17px]">
                Check out
              </ButtonLink>
            )
          )}
        </aside>
      </div>

      {cart.lines.length > 0 && (
        <div className="sticky bottom-0 -mx-5 -mb-10 border-t border-(--color-divider) bg-(--color-bg) px-4 py-3 md:hidden">
          <ButtonLink variant="primary" href={checkoutHref} className="min-h-14 w-full !text-lg">
            Check out · {cart.countText}
            {pricesVisible && ` · ${formatCents(cart.totalCents)}`}
          </ButtonLink>
        </div>
      )}
    </>
  );
}
