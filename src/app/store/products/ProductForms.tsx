"use client";

import { ActionForm } from "@/components/ActionForm";
import { Button, Field, Input } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { addBarcode, deleteBarcode, deletePack, savePack, saveProduct, saveThresholds } from "./actions";

const money = (v: number | null | undefined) => (v === null || v === undefined ? "" : Number(v).toFixed(2));

export function ProductForm({ product, canEdit }: { product?: Tables<"products">; canEdit: boolean }) {
  return (
    <ActionForm action={saveProduct} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(pending) => (
        <fieldset disabled={!canEdit} className="contents">
          {product && <input type="hidden" name="id" value={product.id} />}
          <Field label="Product name">
            <Input name="name" defaultValue={product?.name} required />
          </Field>
          <Field label="Brand">
            <Input name="brand" defaultValue={product?.brand ?? ""} />
          </Field>
          <Field label="Category" hint="Beer, ice, soda, ...">
            <Input name="category" defaultValue={product?.category ?? ""} />
          </Field>
          <Field label="Singles per case">
            <Input name="case_size" type="number" min={1} step={1} defaultValue={product?.case_size ?? 24} required />
          </Field>
          <Field label="Cost per case ($)" hint="What you pay. Used for profit.">
            <Input name="cost_per_case" inputMode="decimal" defaultValue={money(product?.cost_per_case)} />
          </Field>
          <Field label="Wholesale price per case ($)">
            <Input name="wholesale_case_price" inputMode="decimal" defaultValue={money(product?.wholesale_case_price)} />
          </Field>
          <Field label="Party price per case ($)">
            <Input name="party_case_price" inputMode="decimal" defaultValue={money(product?.party_case_price)} />
          </Field>
          {product && (
            <label className="flex min-h-11 items-center gap-2 self-end text-sm">
              <input type="hidden" name="has_active" value="1" />
              <input type="checkbox" name="active" defaultChecked={product.active} /> Active (uncheck to hide a discontinued item)
            </label>
          )}
          {canEdit && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Button disabled={pending}>{pending ? "Saving..." : product ? "Save product" : "Create product"}</Button>
            </div>
          )}
        </fieldset>
      )}
    </ActionForm>
  );
}

const presets = [
  { label: "Single", units: 1 },
  { label: "4 pack", units: 4 },
  { label: "6 pack", units: 6 },
  { label: "12 pack", units: 12 },
];

export function PackRow({ pack, productId, canEdit }: { pack?: Tables<"pack_sizes">; productId: string; canEdit: boolean }) {
  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-(--color-divider) py-3">
      <ActionForm action={savePack} className="flex flex-1 flex-wrap items-end gap-2">
        {(pending) => (
          <fieldset disabled={!canEdit} className="contents">
            {pack && <input type="hidden" name="id" value={pack.id} />}
            <input type="hidden" name="product_id" value={productId} />
            <Field label="Pack">
              <Input name="label" defaultValue={pack?.label ?? ""} list="pack-presets" className="!w-32" required />
            </Field>
            <Field label="Singles">
              <Input name="units" type="number" min={1} defaultValue={pack?.units ?? ""} className="!w-20" required />
            </Field>
            <Field label="Cash $">
              <Input name="cash_price" inputMode="decimal" defaultValue={money(pack?.cash_price)} className="!w-24" required />
            </Field>
            <Field label="Card $">
              <Input name="card_price" inputMode="decimal" defaultValue={money(pack?.card_price)} className="!w-24" required />
            </Field>
            <Field label="Barcode (if it has one)">
              <Input name="barcode" defaultValue={pack?.barcode ?? ""} className="!w-44" />
            </Field>
            {canEdit && (
              <Button variant={pack ? "secondary" : "primary"} disabled={pending}>
                {pack ? "Save" : "Add pack"}
              </Button>
            )}
          </fieldset>
        )}
      </ActionForm>
      {pack && canEdit && (
        <form action={deletePack}>
          <input type="hidden" name="id" value={pack.id} />
          <input type="hidden" name="product_id" value={productId} />
          <Button variant="danger">
            Remove
          </Button>
        </form>
      )}
      <datalist id="pack-presets">
        {presets.map((p) => (
          <option key={p.label} value={p.label} />
        ))}
      </datalist>
    </div>
  );
}

export function Barcodes({ productId, barcodes }: { productId: string; barcodes: Tables<"product_barcodes">[] }) {
  return (
    <div className="flex flex-col gap-3">
      {barcodes.length === 0 && <p className="!m-0 text-sm text-(--color-neutral-700)">No extra barcodes.</p>}
      <ul className="!m-0 flex list-none flex-col gap-1 !p-0">
        {barcodes.map((b) => (
          <li key={b.barcode} className="flex items-center gap-3 text-sm">
            <span className="font-mono">{b.barcode}</span>
            {b.is_case && <span className="text-(--color-neutral-700)">case</span>}
            <form action={deleteBarcode}>
              <input type="hidden" name="barcode" value={b.barcode} />
              <input type="hidden" name="product_id" value={productId} />
              <Button variant="danger">Remove</Button>
            </form>
          </li>
        ))}
      </ul>
      <ActionForm action={addBarcode} className="flex flex-wrap items-end gap-2">
        {(pending) => (
          <>
            <input type="hidden" name="product_id" value={productId} />
            <Field label="Add barcode" hint="Scan it with the scanner, or type it.">
              <Input name="barcode" className="!w-56" />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" name="is_case" /> This is a case barcode
            </label>
            <Button variant="secondary" disabled={pending}>
              Add
            </Button>
          </>
        )}
      </ActionForm>
    </div>
  );
}

export function ThresholdsForm({
  productId,
  caseSize,
  retail,
  warehouse,
}: {
  productId: string;
  caseSize: number;
  retail?: Tables<"stock_thresholds">;
  warehouse?: Tables<"stock_thresholds">;
}) {
  return (
    <ActionForm action={saveThresholds} className="grid gap-4 sm:grid-cols-2">
      {(pending) => (
        <>
          <input type="hidden" name="product_id" value={productId} />
          <div className="flex flex-col gap-2">
            <p className="!m-0 text-sm font-medium">Front fridges (singles)</p>
            <div className="flex gap-2">
              <Field label="Low at">
                <Input name="retail_min" type="number" min={0} defaultValue={retail?.min_qty ?? ""} />
              </Field>
              <Field label="Refill to" hint={`1 case = ${caseSize} singles`}>
                <Input name="retail_target" type="number" min={0} defaultValue={retail?.target_qty ?? ""} />
              </Field>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="!m-0 text-sm font-medium">Warehouse (cases)</p>
            <div className="flex gap-2">
              <Field label="Low at">
                <Input name="warehouse_min" type="number" min={0} defaultValue={warehouse?.min_qty ?? ""} />
              </Field>
              <Field label="Reorder up to">
                <Input name="warehouse_target" type="number" min={0} defaultValue={warehouse?.target_qty ?? ""} />
              </Field>
            </div>
          </div>
          <div className="sm:col-span-2">
            <Button variant="secondary" disabled={pending}>
              Save low-stock levels
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
