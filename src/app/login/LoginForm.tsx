"use client";

import { ActionForm } from "@/components/ActionForm";
import { Button, Field, Input } from "@/components/ui";
import { signIn } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn} className="space-y-4">
      {(pending) => (
        <>
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          <details className="text-sm">
            <summary className="cursor-pointer opacity-70">First time setting up the system?</summary>
            <div className="mt-3">
              <Field label="Your name" hint="Only used for the very first login, which becomes the first manager.">
                <Input name="full_name" autoComplete="name" />
              </Field>
            </div>
          </details>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}
