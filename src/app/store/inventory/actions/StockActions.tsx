"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { ButtonLink, Button, ChoiceGrid, Input, Notice, StepHeading, Stepper } from "@/components/ui";
import { stockForProduct, unitWord, type BarcodeHit, type Loc, type Product, type StockRow } from "@/lib/inventory";
import { countStock, moveStock, receiveStock, restockFront } from "../stockActions";
import { ProductPicker } from "./ProductPicker";

export type Tab = "receive" | "restock" | "move" | "count";

const TABS: { id: Tab; label: string; short: string; help: string }[] = [
  { id: "receive", label: "Receive", short: "Receive", help: "A supplier delivery arrived. Add it where you put it." },
  { id: "restock", label: "Restock front", short: "Restock", help: "Bring cases from the warehouse into a front fridge. Cases turn into singles." },
  { id: "move", label: "Move", short: "Move", help: "Move stock between two warehouse spots, or between two front fridges." },
  { id: "count", label: "Count", short: "Count", help: "Counted a spot by hand? Enter the real number and the system will match it." },
];

const ACTIONS = { receive: receiveStock, restock: restockFront, move: moveStock, count: countStock };

export function StockActions({
  tab,
  locations,
  products,
  stock,
  barcodes,
  initialProduct,
}: {
  tab: Tab;
  locations: Loc[];
  products: Product[];
  stock: StockRow[];
  barcodes: BarcodeHit[];
  initialProduct: Product | null;
}) {
  const [product, setProduct] = useState<Product | null>(initialProduct);
  const [scanned, setScanned] = useState<BarcodeHit | undefined>();
  const [locationId, setLocationId] = useState("");
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [state, formAction, pending] = useActionState(ACTIONS[tab], null);

  useEffect(() => {
    if (!state?.ok) return;
    // Reset for the next one after a save; the task stays.
    /* eslint-disable react-hooks/set-state-in-effect */
    setProduct(null);
    setScanned(undefined);
    setQty(1);
    setNote("");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state]);

  const qtyFor = useMemo(() => (product ? stockForProduct(stock, product.id) : new Map<string, number>()), [stock, product]);
  const locById = new Map(locations.map((l) => [l.id, l]));
  const retail = locations.filter((l) => l.catalog === "retail");
  const warehouse = locations.filter((l) => l.catalog === "warehouse");
  const current = TABS.find((t) => t.id === tab)!;

  // "12 singles front · 3 cases back" for any product.
  const describe = (p: Product) => {
    let front = 0;
    let back = 0;
    for (const s of stock) {
      if (s.product_id !== p.id) continue;
      if (locById.get(s.location_id)?.catalog === "retail") front += s.quantity;
      else back += s.quantity;
    }
    const line = `${front} ${unitWord("retail", front)} front · ${back} ${unitWord("warehouse", back)} back`;
    if (p.id !== product?.id || !scanned) return line;
    return `Scanned a ${scanned.isCase ? "case" : scanned.units === 1 ? "single" : `${scanned.units}-pack`} barcode · ${line}`;
  };

  const pick = (p: Product | null, hit?: BarcodeHit) => {
    setProduct(p);
    setScanned(hit);
    if (p && hit && tab === "receive" && !locationId) {
      const first = (hit.isCase ? warehouse : retail)[0];
      if (first) setLocationId(first.id);
    }
  };

  const choices = (locs: Loc[]) =>
    locs.map((l) => {
      const q = qtyFor.get(l.id) ?? 0;
      return { id: l.id, name: l.name, sub: product ? `${q} ${unitWord(l.catalog, q)} here` : unitWord(l.catalog, 2) };
    });
  const moveTargets = fromId ? locations.filter((l) => l.catalog === locById.get(fromId)?.catalog && l.id !== fromId) : [];

  const spots: { label: string; name: string; value: string; set: (id: string) => void; locs: Loc[]; waiting?: boolean }[] = {
    receive: [{ label: "Put it in", name: "location_id", value: locationId, set: setLocationId, locs: locations }],
    restock: [
      { label: "From (warehouse)", name: "from_id", value: fromId, set: setFromId, locs: warehouse },
      { label: "Into (front fridge)", name: "to_id", value: toId, set: setToId, locs: retail },
    ],
    move: [
      {
        label: "From",
        name: "from_id",
        value: fromId,
        set: (id: string) => {
          setFromId(id);
          setToId("");
        },
        locs: locations,
      },
      { label: "To", name: "to_id", value: toId, set: setToId, locs: moveTargets, waiting: !fromId },
    ],
    count: [{ label: "Spot you counted", name: "location_id", value: locationId, set: setLocationId, locs: locations }],
  }[tab];

  const qtyLoc = locById.get(tab === "move" ? fromId : locationId);
  const unit = qtyLoc ? unitWord(qtyLoc.catalog, 2) : "units";
  const qtyLabel = tab === "restock" ? "How many cases" : tab === "count" ? `Counted (${unit})` : `How many (${unit})`;
  const qtyHint =
    tab === "restock" && product && qty > 0
      ? `= ${qty * product.case_size} singles into the fridge`
      : tab === "count" && product && locationId
        ? `System has ${qtyFor.get(locationId) ?? 0}`
        : "";
  const ready = product && spots.every((s) => s.value) && qty >= (tab === "count" ? 0 : 1);

  return (
    <>
      {state && (
        <Notice
          ok={state.ok}
          action={
            state.ok && (
              <ButtonLink href="/store" variant="secondary">
                Done
              </ButtonLink>
            )
          }
        >
          {state.message}
        </Notice>
      )}

      <nav className="seg flex w-full max-w-[640px]">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/store/inventory/actions?task=${t.id}`}
            aria-current={t.id === tab ? "page" : undefined}
            className={`flex min-h-11 flex-1 items-center justify-center border-r border-(--color-divider) px-1.5 text-sm whitespace-nowrap !no-underline last:border-r-0 ${
              t.id === tab ? "bg-(--color-accent) !text-(--color-bg)" : "!text-(--color-text) hover:bg-(--color-accent-100)"
            }`}
          >
            {t.short}
          </Link>
        ))}
      </nav>
      <p className="!m-0 max-w-[640px] text-(--color-neutral-700)">{current.help}</p>

      <form action={formAction} className="flex max-w-[640px] flex-col gap-7">
        <section className="flex flex-col gap-2.5">
          <StepHeading n={1}>Product</StepHeading>
          <ProductPicker products={products} barcodes={barcodes} value={product} onChange={pick} describe={describe} />
        </section>

        {spots.map((s, i) => (
          <section key={s.name} className="flex flex-col gap-2.5">
            <StepHeading n={i + 2}>{s.label}</StepHeading>
            {s.waiting && <p className="!m-0 text-(--color-neutral-700)">Pick &ldquo;From&rdquo; first.</p>}
            <ChoiceGrid options={choices(s.locs)} value={s.value} onChange={s.set} />
            <input type="hidden" name={s.name} value={s.value} />
          </section>
        ))}

        <section className="flex flex-col gap-2.5">
          <StepHeading n={spots.length + 2}>{qtyLabel}</StepHeading>
          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
            <Stepper size="lg" name="qty" value={qty} onChange={setQty} />
            {qtyHint && <span className="text-sm text-(--color-neutral-700)">{qtyHint}</span>}
          </div>
          <Input
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={tab === "receive" ? "Note (optional): supplier or invoice #" : "Note (optional)"}
            className="mt-1.5 !min-h-11 !text-[15px]"
          />
        </section>

        <Button disabled={pending || !ready} className="min-h-14 w-full !text-[19px]">
          {pending ? "Saving..." : current.label}
        </Button>
      </form>
    </>
  );
}
