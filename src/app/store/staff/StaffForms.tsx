"use client";

import { ActionForm } from "@/components/ActionForm";
import { Button, Field, Input, Select } from "@/components/ui";
import type { Tables } from "@/lib/database.types";
import { addStaff, updateStaff } from "./actions";

const roles = [
  { value: "staff", label: "Staff" },
  { value: "manager", label: "Manager" },
  { value: "driver", label: "Driver" },
];

export function AddStaffForm() {
  return (
    <ActionForm action={addStaff} className="grid gap-3 sm:grid-cols-2">
      {(pending) => (
        <>
          <Field label="Full name">
            <Input name="full_name" required />
          </Field>
          <Field label="Email (their login)">
            <Input name="email" type="email" required />
          </Field>
          <Field label="Temporary password" hint="At least 8 characters. They can change it later.">
            <Input name="password" type="text" minLength={8} required />
          </Field>
          <Field label="Role">
            <Select name="role" defaultValue="staff">
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="can_edit_prices" /> Can change prices and products
          </label>
          <div className="sm:col-span-2">
            <Button disabled={pending}>{pending ? "Adding..." : "Add staff member"}</Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}

export function StaffRow({ person }: { person: Tables<"staff"> }) {
  return (
    <ActionForm action={updateStaff} className="flex flex-wrap items-center gap-4 border-b border-black/10 py-3 dark:border-white/15">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={person.id} />
          <span className="min-w-40 font-medium">{person.full_name}</span>
          <Select name="role" defaultValue={person.role} className="!w-36">
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="can_edit_prices" defaultChecked={person.can_edit_prices} /> Prices
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={person.active} /> Active
          </label>
          <Button variant="secondary" disabled={pending}>
            Save
          </Button>
        </>
      )}
    </ActionForm>
  );
}
