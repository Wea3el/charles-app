"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Button, Field, Input, Select } from "@/components/ui";
import { KIND_LABEL, stockForProduct, unitWord, type BarcodeHit, type Loc, type Product, type StockRow } from "@/lib/inventory";
import { countStock, moveStock, receiveStock, restockFront } from "../stockActions";
import { ProductPicker } from "./ProductPicker";

export type Tab = "receive" | "restock" | "move" | "count";

const TABS: { id: Tab; label: string; help: string }[] = [
  { id: "receive", label: "Receive", help: "A supplier delivery arrived. Add it where you put it." },
  { id: "restock", label: "Restock front", help: "Bring cases from the warehouse into a front fridge. Cases turn into singles." },
  { id: "move", label: "Move", help: "Move stock between two warehouse spots, or between two front fridges." },
  { id: "count", label: "Count", help: "Counted a spot by hand? Enter the real number and the system will match it." },
];

function LocationOptions({ locations, qtyFor }: { locations: Loc[]; qtyFor?: Map<string, number> }) {
  const kinds = [...new Set(locations.map((l) => l.kind))];
  return (
    <>
      <option value="">Choose...</option>
      {kinds.map((kind) => (
        <optgroup key={kind} label={KIND_LABEL[kind]}>
          {locations
            .filter((l) => l.kind === kind)
            .map((l) => {
              const q = qtyFor?.get(l.id);
              return (
                <option key={l.id} value={l.id}>
                  {l.name}
                  {qtyFor ? ` (${q ?? 0} ${unitWord(l.catalog, q ?? 0)})` : ""}
                </option>
              );
            })}
        </optgroup>
      ))}
    </>
  );
}

export function StockActions({
  tab,
  locations,
  products,
  stock,
  barcodes,
}: {
  tab: Tab;
  locations: Loc[];
  products: Product[];
  stock: StockRow[];
  barcodes: BarcodeHit[];
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [scanned, setScanned] = useState<BarcodeHit | undefined>();
  const [locationId, setLocationId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState("");

  const qtyFor = useMemo(() => (product ? stockForProduct(stock, product.id) : new Map<string, number>()), [stock, product]);
  const locById = new Map(locations.map((l) => [l.id, l]));
  const retail = locations.filter((l) => l.catalog === "retail");
  const warehouse = locations.filter((l) => l.catalog === "warehouse");
  const current = TABS.find((t) => t.id === tab)!;

  const pick = (p: Product | null, hit?: BarcodeHit) => {
    setProduct(p);
    setScanned(hit);
    if (p && hit && tab === "receive" && !locationId) {
      const first = (hit.isCase ? warehouse : retail)[0];
      if (first) setLocationId(first.id);
    }
  };

  const action = { receive: receiveStock, restock: restockFront, move: moveStock, count: countStock }[tab];
  const unitFor = (id: string) => (locById.get(id) ? unitWord(locById.get(id)!.catalog, 2) : "units");
  const moveTargets = fromId ? locations.filter((l) => l.catalog === locById.get(fromId)?.catalog && l.id !== fromId) : [];

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/store/inventory/actions?tab=${t.id}`}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${
              t.id === tab ? "bg-foreground text-background" : "border border-black/15 dark:border-white/20"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <p className="opacity-70">{current.help}</p>

      <ActionForm
        action={action}
        className="max-w-xl space-y-4"
        onSuccess={() => {
          setProduct(null);
          setScanned(undefined);
          setQty("");
        }}
      >
        {(pending) => (
          <>
            <Field label="Product">
              <ProductPicker products={products} barcodes={barcodes} value={product} onChange={pick} />
            </Field>
            {scanned && (
              <p className="-mt-2 text-sm opacity-70">Scanned a {scanned.isCase ? "case" : scanned.units === 1 ? "single" : `${scanned.units}-pack`} barcode.</p>
            )}

            {(tab === "receive" || tab === "count") && (
              <Field label={tab === "receive" ? "Put it in" : "Spot you counted"}>
                <Select name="location_id" value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
                  <LocationOptions locations={locations} qtyFor={product ? qtyFor : undefined} />
                </Select>
              </Field>
            )}

            {tab === "restock" && (
              <>
                <Field label="From (warehouse)">
                  <Select name="from_id" value={fromId} onChange={(e) => setFromId(e.target.value)} required>
                    <LocationOptions locations={warehouse} qtyFor={product ? qtyFor : undefined} />
                  </Select>
                </Field>
                <Field label="Into (front fridge)">
                  <Select name="to_id" value={toId} onChange={(e) => setToId(e.target.value)} required>
                    <LocationOptions locations={retail} qtyFor={product ? qtyFor : undefined} />
                  </Select>
                </Field>
              </>
            )}

            {tab === "move" && (
              <>
                <Field label="From">
                  <Select
                    name="from_id"
                    value={fromId}
                    onChange={(e) => {
                      setFromId(e.target.value);
                      setToId("");
                    }}
                    required
                  >
                    <LocationOptions locations={locations} qtyFor={product ? qtyFor : undefined} />
                  </Select>
                </Field>
                <Field label="To" hint="Front fridges only move to front fridges; warehouse spots only to warehouse spots. Use Restock front for warehouse to fridge.">
                  <Select name="to_id" value={toId} onChange={(e) => setToId(e.target.value)} required disabled={!fromId}>
                    <LocationOptions locations={moveTargets} qtyFor={product ? qtyFor : undefined} />
                  </Select>
                </Field>
              </>
            )}

            <Field
              label={
                tab === "restock"
                  ? "How many cases"
                  : tab === "count"
                    ? `Counted (${unitFor(locationId)})`
                    : `How many (${unitFor(tab === "move" ? fromId : locationId)})`
              }
              hint={
                tab === "restock" && product && Number(qty) > 0
                  ? `= ${Number(qty) * product.case_size} singles into the fridge`
                  : tab === "count" && product && locationId
                    ? `System currently has ${qtyFor.get(locationId) ?? 0}`
                    : undefined
              }
            >
              <Input
                name="qty"
                type="number"
                inputMode="numeric"
                min={tab === "count" ? 0 : 1}
                step={1}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
                className="!w-40 text-lg"
              />
            </Field>

            <Field label="Note (optional)">
              <Input name="note" placeholder={tab === "receive" ? "Supplier or invoice #" : ""} />
            </Field>

            <Button disabled={pending || !product} className="w-full sm:w-auto">
              {pending ? "Saving..." : current.label}
            </Button>
          </>
        )}
      </ActionForm>
    </div>
  );
}
