"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button, ButtonLink, ChoiceGrid, Corners, StepHeading, type Choice } from "@/components/ui";
import { formatCents } from "@/lib/pricing";
import type { ShopItem, ShopKind } from "@/lib/shop";
import { CartLines, FLAG_NOTE, useCart } from "./cart";

const PAY: Record<ShopKind, string[]> = {
  wholesale: ["Cash", "Check", "Card", "Zelle", "Invoice"],
  retail: ["Cash", "Card"],
};

const hourText = (h: number) => `${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`;

/** The next five days; today is closed once it's past the same-day cutoff. */
function nextDays(cutoffHour: number): Choice[] {
  const now = new Date();
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const closed = i === 0 && now.getHours() >= cutoffHour;
    return {
      id: d.toLocaleDateString("en-CA"),
      name: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "long" }),
      sub: closed ? `Closed after ${hourText(cutoffHour)}` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      disabled: closed,
    };
  });
}

export function Checkout({
  kind,
  items,
  pricesVisible,
  cutoffHour = 15,
}: {
  kind: ShopKind;
  items: ShopItem[];
  pricesVisible: boolean;
  cutoffHour?: number;
}) {
  const [day, setDay] = useState("");
  const [pay, setPay] = useState("");
  const [days, setDays] = useState<Choice[]>([]);
  // Dates depend on the viewer's clock, so build them in the browser.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDays(nextDays(cutoffHour)), [cutoffHour]);
  const cart = useCart(kind, items, kind === "retail" && pay === "Card");

  const wholesale = kind === "wholesale";
  const needSignIn = wholesale && !pricesVisible;
  const missing =
    cart.lines.length === 0
      ? "Add something to your order first."
      : needSignIn
        ? "Sign in to place a wholesale order."
        : !day
          ? `Pick a ${wholesale ? "delivery" : "pickup"} day.`
          : !pay
            ? "Pick how you'll pay."
            : // ponytail: placing orders is Phase 3 (orders / order_lines); enable once that server action exists.
              "Online ordering isn't open yet. Call the store to place this order.";

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

        {needSignIn && (
          <div className="blueprint flex flex-wrap items-center gap-3 p-4">
            <Corners />
            <span className="min-w-[200px] flex-1">Sign in with an approved business account to see prices and order.</span>
            <ButtonLink href={`/login?next=/shop/wholesale/checkout`}>Sign in</ButtonLink>
          </div>
        )}

        <section className="flex flex-col gap-2.5">
          <StepHeading n={2}>{wholesale ? "Delivery day" : "Pickup day"}</StepHeading>
          <ChoiceGrid options={days} value={day} onChange={setDay} min={104} />
          <p className="!m-0 text-[13px] text-(--color-neutral-700)">
            Same-day online orders close at {hourText(cutoffHour)}. After that, call the store.
          </p>
        </section>

        <section className="flex flex-col gap-2.5">
          <StepHeading n={3}>{wholesale ? "How you'll pay" : "Pay at pickup"}</StepHeading>
          <ChoiceGrid options={PAY[kind].map((p) => ({ id: p, name: p }))} value={pay} onChange={setPay} min={104} />
          {!wholesale && (
            <p className="!m-0 text-[13px] text-(--color-neutral-700)">Card prices are a little higher than cash. The total updates when you pick.</p>
          )}
        </section>

        <div className="flex flex-col gap-2">
          {cart.lines.length > 0 && pricesVisible && (
            <div className="flex justify-between text-[19px] font-semibold">
              <span>Estimated total</span>
              <span className="tabular-nums">{formatCents(cart.totalCents)}</span>
            </div>
          )}
          <Button disabled className="min-h-14 w-full !text-[19px]">
            Place order
          </Button>
          <p className="!m-0 text-center text-[13px] text-(--color-neutral-700)">{missing}</p>
        </div>
      </div>
    </div>
  );
}
