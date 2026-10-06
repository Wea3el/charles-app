"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Button, ChoiceGrid, Corners, Field, Input } from "@/components/ui";
import type { ShopKind } from "@/lib/shop";
import { customerSignIn, customerSignUp } from "./actions";

const KINDS = [
  { id: "wholesale", name: "Business", sub: "Licensed, wholesale prices" },
  { id: "retail", name: "Regular customer", sub: "21+, retail prices" },
];

export function SignInForm({ next }: { next?: string }) {
  return (
    <ActionForm action={customerSignIn} className="flex flex-col gap-4">
      {(pending) => (
        <>
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Signing in..." : "Sign in"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}

export function SignUpForm({ kind: initialKind, next }: { kind: ShopKind; next?: string }) {
  const [kind, setKind] = useState<ShopKind>(initialKind);
  const wholesale = kind === "wholesale";
  return (
    <ActionForm action={customerSignUp} className="flex flex-col gap-4">
      {(pending) => (
        <>
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="next" value={next ?? ""} />
          <ChoiceGrid options={KINDS} value={kind} onChange={(k) => setKind(k as ShopKind)} min={180} />
          {wholesale && (
            <Field label="Business name">
              <Input name="business_name" autoComplete="organization" required />
            </Field>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your name">
              <Input name="contact_name" autoComplete="name" required />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" autoComplete="tel" required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <Input name="email" type="email" autoComplete="email" required />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
              <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
            </Field>
          </div>
          {wholesale ? (
            <>
              <Field label="Delivery address">
                <Input name="address_line" autoComplete="street-address" required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[1fr_90px_120px]">
                <Field label="City">
                  <Input name="city" autoComplete="address-level2" required />
                </Field>
                <Field label="State">
                  <Input name="state" autoComplete="address-level1" />
                </Field>
                <Field label="ZIP">
                  <Input name="postal_code" autoComplete="postal-code" inputMode="numeric" />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Liquor license number">
                  <Input name="liquor_license_no" required />
                </Field>
                <Field label="License expires">
                  <Input name="license_expires_on" type="date" />
                </Field>
                <Field label="Tax ID">
                  <Input name="tax_id" required />
                </Field>
              </div>
              <div className="blueprint p-4 text-sm">
                <Corners />
                The store checks your license before you can see prices and order. We&apos;ll email you once you&apos;re approved.
              </div>
            </>
          ) : (
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="age_21" required className="size-5" />
              <span>I&apos;m 21 or older. I&apos;ll show ID at pickup.</span>
            </label>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating account..." : wholesale ? "Apply for a business account" : "Create account"}
          </Button>
        </>
      )}
    </ActionForm>
  );
}
