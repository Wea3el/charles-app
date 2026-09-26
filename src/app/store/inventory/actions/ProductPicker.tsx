"use client";

import { useState } from "react";
import { Input } from "@/components/ui";
import { findBarcode, searchProducts, type BarcodeHit, type Product } from "@/lib/inventory";

/**
 * Scan a barcode (the scanner types it and presses Enter) or type a name.
 */
export function ProductPicker({
  products,
  barcodes,
  value,
  onChange,
}: {
  products: Product[];
  barcodes: BarcodeHit[];
  value: Product | null;
  onChange: (p: Product | null, scanned?: BarcodeHit) => void;
}) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const results = searchProducts(products, query);
  const byId = new Map(products.map((p) => [p.id, p]));

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-green-600 bg-green-50 px-3 py-2 dark:bg-green-950">
        <div>
          <div className="font-semibold">{value.name}</div>
          <div className="text-xs opacity-70">1 case = {value.case_size} singles</div>
        </div>
        <button type="button" className="text-sm underline" onClick={() => onChange(null)}>
          Change
        </button>
        <input type="hidden" name="product_id" value={value.id} />
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        autoFocus
        placeholder="Scan a barcode or type a product name"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setMessage(null);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const hit = findBarcode(barcodes, query);
          const scanned = hit ? byId.get(hit.product_id) : undefined;
          if (scanned) {
            onChange(scanned, hit);
            setQuery("");
          } else if (results.length === 1) {
            onChange(results[0]);
            setQuery("");
          } else if (/^\d{6,}$/.test(query.trim())) {
            setMessage("That barcode isn't on any product yet. Add it on the product's page.");
          }
        }}
      />
      {message && <p className="mt-1 text-sm text-red-700 dark:text-red-300">{message}</p>}
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-black/15 bg-background shadow-lg dark:border-white/20">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-black/5 dark:hover:bg-white/10"
                onClick={() => {
                  onChange(p);
                  setQuery("");
                }}
              >
                {p.name}
                {!p.active && <span className="ml-2 text-xs opacity-60">(inactive)</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
