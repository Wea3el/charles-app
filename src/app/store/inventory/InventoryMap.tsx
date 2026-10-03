"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Corners, SearchField } from "@/components/ui";
import {
  KIND_LABEL,
  matchesQuery,
  summarizeLocations,
  unitWord,
  type Loc,
  type Product,
  type StockRow,
} from "@/lib/inventory";

const KIND_ORDER: Loc["kind"][] = ["commercial_fridge", "industrial_fridge", "warehouse_area"];

export function InventoryMap({ locations, products, stock }: { locations: Loc[]; products: Product[]; stock: StockRow[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const matchingIds = useMemo(
    () => (query.trim() ? new Set(products.filter((p) => matchesQuery(p, query)).map((p) => p.id)) : null),
    [products, query],
  );
  const summaries = useMemo(() => summarizeLocations(stock, matchingIds), [stock, matchingIds]);
  const locById = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // "Where is it?" answer for the search: product -> locations with quantities.
  const whereList = useMemo(() => {
    if (!matchingIds) return [];
    const byProduct = new Map<string, { loc: Loc; qty: number }[]>();
    for (const s of stock) {
      if (s.quantity <= 0 || !matchingIds.has(s.product_id)) continue;
      const loc = locById.get(s.location_id);
      if (!loc) continue;
      const list = byProduct.get(s.product_id) ?? [];
      list.push({ loc, qty: s.quantity });
      byProduct.set(s.product_id, list);
    }
    return [...matchingIds]
      .map((id) => ({ product: productById.get(id)!, spots: (byProduct.get(id) ?? []).sort((a, b) => a.loc.sort_order - b.loc.sort_order) }))
      .sort((a, b) => b.spots.length - a.spots.length || a.product.name.localeCompare(b.product.name))
      .slice(0, 12);
  }, [matchingIds, stock, locById, productById]);

  const selectedLoc = selected ? locById.get(selected) : null;
  useEffect(() => {
    if (selected) document.getElementById("location-detail")?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  const selectedItems = useMemo(() => {
    if (!selected) return [];
    return stock
      .filter((s) => s.location_id === selected && s.quantity > 0)
      .map((s) => ({ product: productById.get(s.product_id), qty: s.quantity }))
      .filter((x) => x.product && (!query.trim() || matchesQuery(x.product, query)))
      .sort((a, b) => a.product!.name.localeCompare(b.product!.name));
  }, [selected, stock, productById, query]);

  return (
    <div className="flex flex-col gap-6">
      <SearchField value={query} onChange={setQuery} placeholder="Type a product or brand, e.g. corona" accent autoFocus />

      {matchingIds && (
        <div className="flex flex-col gap-2.5">
          {whereList.length === 0 && <p className="!m-0">No products match &ldquo;{query}&rdquo;.</p>}
          {whereList.map(({ product, spots }) => (
            <div key={product.id} className="blueprint flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
              <Corners />
              <div className="min-w-[180px] font-(family-name:--font-heading) text-[19px] font-semibold">{product.name}</div>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {spots.length === 0 ? (
                  <span className="text-sm font-semibold text-(--color-accent-900)">None in stock</span>
                ) : (
                  spots.map((s) => (
                    <span key={s.loc.id} className="tag tag-accent !px-2.5 !py-[5px] !text-[13px]">
                      {s.loc.name} · {s.qty} {unitWord(s.loc.catalog, s.qty)}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {KIND_ORDER.map((kind) => {
        const locs = locations.filter((l) => l.kind === kind);
        if (locs.length === 0) return null;
        return (
          <section key={kind} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <h4 className="!m-0">{KIND_LABEL[kind]}</h4>
              <Badge>counted in {locs[0].catalog === "retail" ? "singles" : "cases"}</Badge>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              {locs.map((loc) => {
                const sum = summaries.get(loc.id);
                const hit = matchingIds ? (sum?.matches.length ?? 0) > 0 : false;
                const dim = matchingIds !== null && !hit;
                return (
                  <button
                    key={loc.id}
                    onClick={() => setSelected(selected === loc.id ? null : loc.id)}
                    aria-pressed={selected === loc.id}
                    className={`flex min-h-[84px] flex-col gap-1 border p-3.5 text-left hover:bg-(--color-accent-100) ${
                      hit ? "bg-(--color-accent-100)" : ""
                    } ${hit || selected === loc.id ? "border-(--color-accent)" : "border-(--color-divider)"} ${dim ? "opacity-40" : ""}`}
                  >
                    <span className="font-semibold">{loc.name}</span>
                    <span className="text-[13px] text-(--color-neutral-700)">
                      {sum ? `${sum.itemCount} item${sum.itemCount === 1 ? "" : "s"} · ${sum.totalUnits} ${unitWord(loc.catalog, sum.totalUnits)}` : "Empty"}
                    </span>
                    {hit &&
                      sum!.matches.slice(0, 3).map((m) => (
                        <span key={m.product_id} className="text-[13px] font-semibold text-(--color-accent-800)">
                          {productById.get(m.product_id)?.name}: {m.quantity}
                        </span>
                      ))}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {selectedLoc && (
        <section id="location-detail" className="blueprint flex flex-col gap-2 p-4">
          <Corners />
          <div className="flex items-center justify-between">
            <h3 className="!m-0">{selectedLoc.name}</h3>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          {selectedItems.length === 0 ? (
            <p className="!m-0 text-(--color-neutral-700)">{query.trim() ? "Nothing here matches the search." : "Nothing here."}</p>
          ) : (
            <table className="table !text-[15px]">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="!text-right">{selectedLoc.catalog === "retail" ? "Singles" : "Cases"}</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map(({ product, qty }) => (
                  <tr key={product!.id}>
                    <td>{product!.name}</td>
                    <td className="text-right text-lg font-semibold tabular-nums">{qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}
