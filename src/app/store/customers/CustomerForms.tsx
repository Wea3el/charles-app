"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Button, ChoiceGrid, Input } from "@/components/ui";
import { setCustomerDiscount, setCustomerStatus } from "./actions";

type Status = "pending" | "approved" | "rejected" | "suspended";

export function StatusButtons({ id, status }: { id: string; status: Status }) {
  const choices: { status: Exclude<Status, "pending">; label: string; variant: "primary" | "secondary" | "danger" }[] =
    status === "approved"
      ? [{ status: "suspended", label: "Suspend", variant: "danger" }]
      : status === "pending"
        ? [
            { status: "approved", label: "Approve", variant: "primary" },
            { status: "rejected", label: "Reject", variant: "danger" },
          ]
        : [{ status: "approved", label: "Approve", variant: "secondary" }];
  return (
    <ActionForm action={setCustomerStatus} className="flex flex-wrap items-center gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={id} />
          {choices.map((c) => (
            <Button key={c.status} name="status" value={c.status} variant={c.variant} disabled={pending}>
              {c.label}
            </Button>
          ))}
        </>
      )}
    </ActionForm>
  );
}

const KINDS = [
  { id: "none", name: "None" },
  { id: "percent", name: "% off" },
  { id: "flat", name: "$ off" },
];

export function DiscountForm({ id, kind, value }: { id: string; kind: string | null; value: number | null }) {
  const [k, setK] = useState(kind ?? "none");
  return (
    <ActionForm action={setCustomerDiscount} className="flex flex-col gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="discount_kind" value={k} />
          <span className="text-xs text-(--color-neutral-700)">Standing discount on every order</span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-[300px]">
              <ChoiceGrid options={KINDS} value={k} onChange={setK} min={90} />
            </div>
            {k !== "none" && (
              <Input name="discount_value" inputMode="decimal" defaultValue={value ?? ""} placeholder={k === "percent" ? "10" : "5.00"} className="!w-28" required />
            )}
            <Button variant="secondary" disabled={pending}>
              Save
            </Button>
          </div>
        </>
      )}
    </ActionForm>
  );
}
