"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Button, ButtonLink, ChoiceGrid, Corners, Field, Input, Notice, StepHeading, Textarea, type Choice } from "@/components/ui";
import { cardFeeCents, cutoffText, orderDays, PAY_ONLINE, PAYMENT_METHODS, type PaymentMethod, type ShopSettings } from "@/lib/orders";
import { formatCents } from "@/lib/pricing";
import type { ShopItem, ShopKind } from "@/lib/shop";
import { placeOrder } from "./actions";
import { CartLines, FLAG_NOTE, useCart } from "./cart";

/** The signed-in customer's account, if any. */
export interface CheckoutAccount {
  kind: ShopKind;
  status: "pending" | "approved" | "rejected" | "suspended";
}

export function Checkout({
  kind,
  items,
  pricesVisible,
  account,
  settings,
  onlinePay,
}: {
  kind: ShopKind;
  items: ShopItem[];
  pricesVisible: boolean;
  account: CheckoutAccount | null;
  settings: ShopSettings;
  /** Square online payments are set up. */
  onlinePay: boolean;
}) {
  const router = useRouter();
  const [day, setDay] = useState("");
  const [pay, setPay] = useState<PaymentMethod | typeof PAY_ONLINE.id | "">("");
  const [notes, setNotes] = useState("");
  const [guest, setGuest] = useState({ name: "", phone: "", email: "", age_21: false });
  const [days, setDays] = useState<Choice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // One id per attempt, kept across retries so a resend never makes a second order.
  const clientId = useRef<string | null>(null);
  // Dates depend on the clock, so build them in the browser.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDays(orderDays(new Date(), settings)), [settings]);
  const online = pay === PAY_ONLINE.id;
  const cart = useCart(kind, items, kind === "retail" && (pay === "card" || online));

  const wholesale = kind === "wholesale";
  const feeCents = wholesale && online ? cardFeeCents(cart.totalCents, settings.cardFeePercent) : 0;
  const payChoices = [...(onlinePay ? [PAY_ONLINE] : []), ...PAYMENT_METHODS[kind]];
  // Retail can check out without an account; wholesale needs an approved one.
  const asGuest = !wholesale && !account;
  const signInHref = `/shop/signin?kind=${kind}&next=/shop/${kind}/checkout`;
  const accountBlock = asGuest
    ? null
    : !account
      ? "Sign in or create an account to place this order."
      : account.kind !== kind
        ? `You're signed in with a ${account.kind} account. Order from the ${account.kind} shop.`
        : account.status === "pending"
          ? "Your business account is waiting for approval. We'll email you once it's approved."
          : account.status !== "approved"
            ? "This account can't order online right now. Call the store."
            : null;
  const guestMissing = !asGuest
    ? null
    : !guest.name.trim() || !guest.phone.trim() || !guest.email.includes("@")
      ? "Enter your name, phone and email, or sign in."
      : !guest.age_21
        ? "Confirm you're 21 or older."
        : null;
  const missing =
    cart.lines.length === 0
      ? "Add something to your order first."
      : (accountBlock ??
        guestMissing ??
        (!day ? `Pick a ${wholesale ? "delivery" : "pickup"} day.` : !pay ? "Pick how you'll pay." : null));

  const submit = () => {
    if (missing || !pay) return;
    setError(null);
    clientId.current ??= crypto.randomUUID();
    startTransition(async () => {
      const result = await placeOrder(
        {
          client_id: clientId.current!,
          kind,
          fulfillment_date: day,
          payment_method: online ? "card" : (pay as PaymentMethod),
          pay_online: online,
          notes: notes.trim() || undefined,
          lines: cart.lines.map((l) => ({ option_id: l.option.id, quantity: l.quantity })),
        },
        asGuest ? guest : undefined,
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      cart.clear();
      // Paying online: on to Square's checkout page, which brings them back to /shop/paid.
      if (result.payUrl) {
        window.location.href = result.payUrl;
        return;
      }
      router.push(`/shop/${kind}?placed=${result.orderNumber}&n=${result.count}&day=${result.date}`);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <ButtonLink href={`/shop/${kind}`}>
          <ChevronLeft size={18} strokeWidth={1.5} />
          Keep shopping
        </ButtonLink>
      </div>
      <h1 className="!m-0 !text-[36px]">Check out</h1>
      <div className="flex max-w-[640px] flex-col gap-7">
        <section className="flex flex-col gap-2.5">
          <StepHeading n={1}>Your order{cart.count > 0 && ` · ${cart.countText}`}</StepHeading>
          {cart.lines.length === 0 && <p className="!m-0 text-(--color-neutral-700)">Your order is empty.</p>}
          <CartLines cart={cart} pricesVisible={pricesVisible} size="md" />
          {cart.anyFlag && <p className="!m-0 text-[13px] text-(--color-neutral-700)">{FLAG_NOTE}</p>}
        </section>

        {accountBlock && (
          <div className="blueprint flex flex-wrap items-center gap-3 p-4">
            <Corners />
            <span className="min-w-[200px] flex-1">{accountBlock}</span>
            {!account && <ButtonLink href={signInHref}>Sign in or create account</ButtonLink>}
          </div>
        )}

        {asGuest && (
          <section className="flex flex-col gap-3">
            <StepHeading n={2}>Your details</StepHeading>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="text-(--color-neutral-700)">Have an account?</span>
              <ButtonLink href={signInHref} className="!min-h-10 text-[13px]">
                Sign in
              </ButtonLink>
              <span className="text-(--color-neutral-700)">Or continue as a guest:</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} autoComplete="name" />
              </Field>
              <Field label="Phone">
                <Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} type="tel" autoComplete="tel" />
              </Field>
            </div>
            <Field label="Email" hint="We email you when the store confirms your order.">
              <Input value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} type="email" autoComplete="email" />
            </Field>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" checked={guest.age_21} onChange={(e) => setGuest({ ...guest, age_21: e.target.checked })} className="size-5" />
              <span>I&apos;m 21 or older. I&apos;ll show ID at pickup.</span>
            </label>
          </section>
        )}

        <section className="flex flex-col gap-2.5">
          <StepHeading n={asGuest ? 3 : 2}>{wholesale ? "Delivery day" : "Pickup day"}</StepHeading>
          <ChoiceGrid options={days} value={day} onChange={setDay} min={104} />
          <p className="!m-0 text-[13px] text-(--color-neutral-700)">
            Same-day online orders close at {cutoffText(settings.sameDayCutoff)}. After that, call the store.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <StepHeading n={asGuest ? 4 : 3}>How you&apos;ll pay</StepHeading>
          <ChoiceGrid options={payChoices} value={pay} onChange={(p) => setPay(p as typeof pay)} min={104} />
          {online && (
            <p className="!m-0 text-[13px] text-(--color-neutral-700)">
              You&apos;ll pay on Square&apos;s secure page next. If anything is short, the difference goes back to your card.
              {wholesale && settings.cardFeePercent > 0 && ` Card payments add a ${settings.cardFeePercent}% card fee.`}
            </p>
          )}
          {!wholesale && !online && (
            <p className="!m-0 text-[13px] text-(--color-neutral-700)">
              {pay ? "Pay when you pick up. " : ""}Card prices are a little higher than cash. The total updates when you pick.
            </p>
          )}
        </section>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-(--color-neutral-700)">Note for the store (optional)</span>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} className="!font-sans !text-base" />
        </label>

        <div className="flex flex-col gap-2">
          {cart.lines.length > 0 && pricesVisible && feeCents > 0 && (
            <div className="flex justify-between text-(--color-neutral-700)">
              <span>Card fee ({settings.cardFeePercent}%)</span>
              <span className="tabular-nums">{formatCents(feeCents)}</span>
            </div>
          )}
          {cart.lines.length > 0 && pricesVisible && (
            <div className="flex justify-between text-[19px] font-semibold">
              <span>Estimated total</span>
              <span className="tabular-nums">{formatCents(cart.totalCents + feeCents)}</span>
            </div>
          )}
          {error && <Notice ok={false}>{error}</Notice>}
          <Button disabled={!!missing || pending} onClick={submit} className="min-h-14 w-full !text-[19px]">
            {pending ? "Placing order..." : online ? "Place order and pay" : "Place order"}
          </Button>
          {missing && <p className="!m-0 text-center text-[13px] text-(--color-neutral-700)">{missing}</p>}
        </div>
      </div>
    </div>
  );
}
