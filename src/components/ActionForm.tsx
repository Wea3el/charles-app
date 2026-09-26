"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import type { ActionResult } from "@/lib/action";
import { Notice } from "@/components/ui";

/**
 * A form wired to a server action. Shows the action's message and passes
 * `pending` to children so buttons can disable while saving.
 * (React resets the form's fields after each successful submit.)
 */
export function ActionForm({
  action,
  children,
  className,
  onSuccess,
}: {
  action: (prev: ActionResult, form: FormData) => Promise<ActionResult>;
  children: (pending: boolean) => ReactNode;
  className?: string;
  onSuccess?: () => void;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) onSuccess?.();
    // Run once per result, not when the callback identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form action={formAction} className={className}>
      {children(pending)}
      {state && (
        <div className="mt-3">
          <Notice ok={state.ok}>{state.message}</Notice>
        </div>
      )}
    </form>
  );
}
