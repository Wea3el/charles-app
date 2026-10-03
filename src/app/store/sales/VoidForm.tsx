"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Button, Input } from "@/components/ui";
import { voidSale } from "./actions";

export function VoidForm({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="danger" onClick={() => setOpen(true)}>
        Void
      </Button>
    );
  }
  return (
    <ActionForm action={voidSale} className="flex flex-wrap items-center gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="sale_id" value={saleId} />
          <Input name="reason" required autoFocus placeholder="Reason (e.g. rang up twice)" className="!w-64" />
          <Button variant="danger" disabled={pending}>
            {pending ? "Voiding..." : "Void sale"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </>
      )}
    </ActionForm>
  );
}
