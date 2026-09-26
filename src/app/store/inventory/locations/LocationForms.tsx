"use client";

import { ActionForm } from "@/components/ActionForm";
import { Button, Field, Input, Select } from "@/components/ui";
import type { Loc } from "@/lib/inventory";
import { addLocation, deleteLocation, updateLocation } from "./actions";

const kinds = [
  { value: "commercial_fridge", label: "Front fridge" },
  { value: "industrial_fridge", label: "Industrial fridge" },
  { value: "warehouse_area", label: "Warehouse area" },
];

function KindSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <Select name="kind" defaultValue={defaultValue ?? "commercial_fridge"}>
      {kinds.map((k) => (
        <option key={k.value} value={k.value}>
          {k.label}
        </option>
      ))}
    </Select>
  );
}

function CatalogSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <Select name="catalog" defaultValue={defaultValue ?? ""}>
      {!defaultValue && <option value="">Automatic</option>}
      <option value="retail">Singles (retail)</option>
      <option value="warehouse">Cases (warehouse)</option>
    </Select>
  );
}

export function AddLocationForm() {
  return (
    <ActionForm action={addLocation} className="flex flex-wrap items-end gap-3">
      {(pending) => (
        <>
          <Field label="Name">
            <Input name="name" placeholder="Front Fridge 5" required />
          </Field>
          <Field label="Type">
            <KindSelect />
          </Field>
          <Field label="Counted in" hint="Automatic: front fridges in singles, everything else in cases.">
            <CatalogSelect />
          </Field>
          <Button disabled={pending}>Add spot</Button>
        </>
      )}
    </ActionForm>
  );
}

export function LocationRow({ loc }: { loc: Loc }) {
  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-black/10 py-3 dark:border-white/15">
      <ActionForm action={updateLocation} className="flex flex-1 flex-wrap items-end gap-3">
        {(pending) => (
          <>
            <input type="hidden" name="id" value={loc.id} />
            <Field label="Name">
              <Input name="name" defaultValue={loc.name} required />
            </Field>
            <Field label="Type">
              <KindSelect defaultValue={loc.kind} />
            </Field>
            <Field label="Counted in">
              <CatalogSelect defaultValue={loc.catalog} />
            </Field>
            <Field label="Order">
              <Input name="sort_order" type="number" defaultValue={loc.sort_order} className="!w-20" />
            </Field>
            <Button variant="secondary" disabled={pending}>
              Save
            </Button>
          </>
        )}
      </ActionForm>
      <ActionForm action={deleteLocation}>
        {(pending) => (
          <>
            <input type="hidden" name="id" value={loc.id} />
            <Button variant="secondary" className="text-red-700" disabled={pending}>
              Delete
            </Button>
          </>
        )}
      </ActionForm>
    </div>
  );
}
