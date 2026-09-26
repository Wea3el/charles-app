"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Input } from "@/components/ui";
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
    if (selected) document.getElementById("location-detail")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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
    <div className="space-y-6">
      <Input
        type="search"
        placeholder="Where is it? Type a product or brand, e.g. corona"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        className="text-lg"
      />

      {matchingIds && (
        <div className="rounded-xl bg-black/5 p-4 text-sm dark:bg-white/10">
          {whereList.length === 0 ? (
            <p>No products match &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul className="space-y-1">
              {whereList.map(({ product, spots }) => (
                <li key={product.id}>
                  <span className="font-medium">{product.name}</span>
                  {": "}
                  {spots.length === 0 ? (
                    <span className="text-red-700 dark:text-red-300">none in stock</span>
                  ) : (
                    spots.map((s, i) => (
                      <span key={s.loc.id}>
                        {i > 0 && ", "}
                        {s.loc.name} ({s.qty} {unitWord(s.loc.catalog, s.qty)})
                      </span>
                    ))
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {KIND_ORDER.map((kind) => {
        const locs = locations.filter((l) => l.kind === kind);
        if (locs.length === 0) return null;
        return (
          <section key={kind}>
            <h2 className="mb-2 flex items-center gap-2 font-semibold">
              {KIND_LABEL[kind]}
              <Badge tone={locs[0].catalog === "retail" ? "retail" : "warehouse"}>
                counted in {locs[0].catalog === "retail" ? "singles" : "cases"}
              </Badge>
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {locs.map((loc) => {
                const sum = summaries.get(loc.id);
                const hit = matchingIds ? (sum?.matches.length ?? 0) > 0 : false;
                const dim = matchingIds !== null && !hit;
                return (
                  <button
                    key={loc.id}
                    onClick={() => setSelected(selected === loc.id ? null : loc.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      hit
                        ? "border-green-600 bg-green-50 ring-2 ring-green-600 dark:bg-green-950"
                        : "border-black/10 dark:border-white/15"
                    } ${dim ? "opacity-40" : ""} ${selected === loc.id ? "outline outline-2 outline-foreground" : ""}`}
                  >
                    <div className="font-semibold">{loc.name}</div>
                    <div className="text-sm opacity-70">
                      {sum ? `${sum.itemCount} item${sum.itemCount === 1 ? "" : "s"} · ${sum.totalUnits} ${unitWord(loc.catalog, sum.totalUnits)}` : "Empty"}
                    </div>
                    {hit &&
                      sum!.matches.slice(0, 3).map((m) => (
                        <div key={m.product_id} className="mt-1 text-sm font-medium">
                          {productById.get(m.product_id)?.name}: {m.quantity}
                        </div>
                      ))}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      {selectedLoc && (
        <section id="location-detail" className="rounded-xl border border-black/10 p-4 dark:border-white/15">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{selectedLoc.name}</h2>
            <button className="text-sm underline opacity-70" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-sm opacity-60">{query.trim() ? "Nothing here matches the search." : "Nothing here."}</p>
          ) : (
            <table className="w-full text-left">
              <thead className="text-sm opacity-60">
                <tr>
                  <th className="py-1">Item</th>
                  <th className="py-1 text-right">{selectedLoc.catalog === "retail" ? "Singles" : "Cases"}</th>
                </tr>
              </thead>
              <tbody>
                {selectedItems.map(({ product, qty }) => (
                  <tr key={product!.id} className="border-t border-black/5 dark:border-white/10">
                    <td className="py-2">{product!.name}</td>
                    <td className="py-2 text-right text-lg font-semibold tabular-nums">{qty}</td>
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
