"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Button, ChoiceGrid, Field, Input, Stepper } from "@/components/ui";
import { PAYMENT_METHODS } from "@/lib/orders";
import { cancelOrder, completeOrder, confirmOrder, recordPayment, refundOrderOverpayment } from "../actions";

export interface ConfirmLine {
  id: string;
  name: string;
  label: string;
  requested: number;
  suggested: number;
  onHandText: string;
}

export function ConfirmForm({ orderId, lines, unit }: { orderId: string; lines: ConfirmLine[]; unit: string }) {
  const [qty, setQty] = useState<Record<string, number>>(() => Object.fromEntries(lines.map((l) => [l.id, l.suggested])));
  const short = lines.filter((l) => qty[l.id] < l.requested).length;
  return (
    <ActionForm action={confirmOrder} className="flex flex-col gap-3">
      {(pending) => (
        <>
          <input type="hidden" name="order_id" value={orderId} />
          {lines.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 border-b border-(--color-divider) pb-3">
              <input type="hidden" name={`qty_${l.id}`} value={qty[l.id]} />
              <div className="min-w-[200px] flex-1">
                <div className="font-semibold">
                  {l.name} · {l.label}
                </div>
                <div className="text-[13px] text-(--color-neutral-700)">
                  Asked for {l.requested} · {l.onHandText}
                </div>
                {qty[l.id] < l.requested && (
                  <div className="text-[13px] font-semibold text-(--color-accent-900)">
                    {qty[l.id] === 0 ? "Declined" : `Short ${l.requested - qty[l.id]}`}
                  </div>
                )}
              </div>
              <Stepper value={qty[l.id]} onChange={(n) => setQty({ ...qty, [l.id]: Math.min(n, l.requested) })} />
              <Button type="button" variant="ghost" onClick={() => setQty({ ...qty, [l.id]: l.requested })} disabled={qty[l.id] === l.requested}>
                All {l.requested}
              </Button>
            </div>
          ))}
          <Button type="submit" disabled={pending} className="min-h-14 !text-lg">
            {pending ? "Confirming..." : short ? `Confirm (${short} line${short === 1 ? "" : "s"} short)` : `Confirm all ${unit}`}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function PaymentForm({ orderId, balanceCents, defaultMethod }: { orderId: string; balanceCents: number; defaultMethod: string | null }) {
  const [method, setMethod] = useState(defaultMethod ?? "");
  return (
    <ActionForm action={recordPayment} className="flex flex-col gap-3">
      {(pending) => (
        <>
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="method" value={method} />
          <ChoiceGrid options={PAYMENT_METHODS.wholesale} value={method} onChange={setMethod} min={90} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Amount">
              <Input name="amount" inputMode="decimal" defaultValue={(balanceCents / 100).toFixed(2)} required />
            </Field>
            <Field label="Check # or reference (optional)">
              <Input name="reference" />
            </Field>
          </div>
          <Button type="submit" disabled={pending || !method}>
            {pending ? "Saving..." : "Save payment"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function CompleteForm({ orderId, label, unpaid }: { orderId: string; label: string; unpaid: boolean }) {
  return (
    <ActionForm action={completeOrder} className="flex flex-col gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="order_id" value={orderId} />
          {unpaid && <p className="!m-0 text-sm text-(--color-neutral-700)">Not paid in full yet. Fine for invoice customers.</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : label}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function CancelForm({ orderId, hasPayments, refundsCard }: { orderId: string; hasPayments: boolean; refundsCard: boolean }) {
  const [open, setOpen] = useState(false);
  if (hasPayments) return <p className="!m-0 text-sm text-(--color-neutral-700)">To cancel, give back the cash, check or Zelle payments first.</p>;
  if (!open) {
    return (
      <div>
        <Button type="button" variant="danger" onClick={() => setOpen(true)}>
          Cancel order
        </Button>
      </div>
    );
  }
  return (
    <ActionForm action={cancelOrder} className="flex flex-wrap items-center gap-2">
      {(pending) => (
        <>
          <input type="hidden" name="order_id" value={orderId} />
          <Input name="reason" required autoFocus placeholder="Reason (the customer sees this)" className="!w-72" />
          {refundsCard && <span className="text-sm text-(--color-neutral-700)">Their online card payment is refunded in full.</span>}
          <Button variant="danger" disabled={pending}>
            {pending ? "Cancelling..." : "Cancel order"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Keep it
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function RefundForm({ orderId }: { orderId: string }) {
  return (
    <ActionForm action={refundOrderOverpayment}>
      {(pending) => (
        <>
          <input type="hidden" name="order_id" value={orderId} />
          <Button variant="secondary" disabled={pending}>
            {pending ? "Refunding..." : "Refund overpayment"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}
