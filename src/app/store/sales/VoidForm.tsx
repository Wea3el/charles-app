"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Button, Input } from "@/components/ui";
import { voidSale } from "./actions";

export function VoidForm({ saleId }: { saleId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="text-sm text-red-700 underline dark:text-red-300" onClick={() => setOpen(true)}>
        Void
      </button>
    );
  }
  return (
    <ActionForm action={voidSale} className="flex flex-wrap items-center gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="sale_id" value={saleId} />
          <Input name="reason" required autoFocus placeholder="Reason (e.g. rang up twice)" className="!w-64 !py-1 text-sm" />
          <Button variant="danger" disabled={pending} className="!py-1">
            {pending ? "Voiding..." : "Void sale"}
          </Button>
          <button type="button" className="text-sm underline" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </>
      )}
    </ActionForm>
  );
}
