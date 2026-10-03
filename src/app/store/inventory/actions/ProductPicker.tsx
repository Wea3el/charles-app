"use client";

import { useRef, useState } from "react";
import { ScanBarcode } from "lucide-react";
import { Button, Corners, Input } from "@/components/ui";
import { findBarcode, searchProducts, type BarcodeHit, type Product } from "@/lib/inventory";

/**
 * Scan a barcode (the scanner types it and presses Enter) or type a name.
 */
export function ProductPicker({
  products,
  barcodes,
  value,
  onChange,
  describe,
}: {
  products: Product[];
  barcodes: BarcodeHit[];
  value: Product | null;
  onChange: (p: Product | null, scanned?: BarcodeHit) => void;
  /** Stock line shown under a product, e.g. "12 singles front · 3 cases back". */
  describe: (p: Product) => string;
}) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const results = searchProducts(products, query);
  const byId = new Map(products.map((p) => [p.id, p]));

  const lookup = () => {
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
    } else {
      input.current?.focus();
    }
  };

  if (value) {
    return (
      <div className="blueprint flex items-center gap-3 px-4 py-3.5">
        <Corners />
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="font-(family-name:--font-heading) text-xl font-semibold">{value.name}</span>
          <span className="text-[13px] text-(--color-neutral-700)">{describe(value)}</span>
        </div>
        <Button type="button" variant="secondary" onClick={() => onChange(null)}>
          Change
        </Button>
        <input type="hidden" name="product_id" value={value.id} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2.5">
        <Input
          ref={input}
          autoFocus
          placeholder="Type a name or brand"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMessage(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            lookup();
          }}
          className="flex-1"
        />
        <Button type="button" variant="secondary" className="min-h-12" onClick={lookup}>
          <ScanBarcode size={20} strokeWidth={1.5} />
          Scan
        </Button>
      </div>
      {message && <p className="!m-0 text-sm font-semibold text-(--color-accent-900)">{message}</p>}
      {results.length > 0 && (
        <div className="flex flex-col">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              className="flex min-h-12 justify-between gap-3 border-b border-(--color-divider) px-3 py-2.5 text-left hover:bg-(--color-accent-100)"
              onClick={() => {
                onChange(p);
                setQuery("");
              }}
            >
              <span className="font-medium">
                {p.name}
                {!p.active && <span className="ml-2 text-xs text-(--color-neutral-700)">(inactive)</span>}
              </span>
              <span className="text-[13px] text-(--color-neutral-700)">{describe(p)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
