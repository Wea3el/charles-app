import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, cardFeeCents, cutoffText, dayPhrase, orderConfirmedEmail, orderDays, storeClock, type EmailOrder } from "./orders.ts";

const NY = { sameDayCutoff: "15:00:00", daysAhead: 5, timeZone: "America/New_York", cardFeePercent: 0 };

test("store clock uses the store's time zone, not the server's", () => {
  // 02:30 UTC on Oct 6 is still Oct 5 in New York (EDT, UTC-4).
  assert.deepEqual(storeClock(new Date("2026-10-06T02:30:00Z"), "America/New_York"), { date: "2026-10-05", minutes: 22 * 60 + 30 });
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("today is open before the cutoff and closed after it", () => {
  const morning = orderDays(new Date("2026-10-05T14:00:00Z"), NY); // 10 AM in New York
  assert.equal(morning.length, 5);
  assert.deepEqual(morning[0], { id: "2026-10-05", name: "Today", sub: "Oct 5", disabled: false });
  assert.equal(morning[1].name, "Tomorrow");
  assert.equal(morning[2].name, "Wednesday");
  assert.equal(morning[4].id, "2026-10-09");

  const late = orderDays(new Date("2026-10-05T19:00:00Z"), NY); // 3 PM sharp
  assert.equal(late[0].disabled, true);
  assert.equal(late[0].sub, "Closed after 3 PM");
});

test("cutoff and day wording", () => {
  assert.equal(cutoffText("15:00:00"), "3 PM");
  assert.equal(cutoffText("09:30:00"), "9:30 AM");
  assert.equal(cutoffText("12:00:00"), "12 PM");
  assert.equal(dayPhrase("2026-10-05", "2026-10-05"), "today");
  assert.equal(dayPhrase("2026-10-06", "2026-10-05"), "tomorrow");
  assert.equal(dayPhrase("2026-10-09", "2026-10-05"), "on Friday");
  assert.equal(dayPhrase("2026-10-20", "2026-10-05"), "on Oct 20");
});

test("confirmation email lists what was short", () => {
  const order: EmailOrder & { status: "partially_confirmed" } = {
    number: 12, kind: "wholesale", date: "2026-10-06", today: "2026-10-05", total: "$162.00", accountUrl: "https://x/shop/account",
    status: "partially_confirmed",
    lines: [
      { name: "Lager", label: "Case of 24", requested: 7, confirmed: 6, status: "partial" },
      { name: "Ice", label: "Each", requested: 2, confirmed: 0, status: "declined" },
      { name: "Soda", label: "Case of 12", requested: 1, confirmed: 1, status: "confirmed" },
    ],
  };
  const e = orderConfirmedEmail(order);
  assert.equal(e.subject, "Order #12 confirmed, some items short");
  assert.match(e.text, /for delivery tomorrow/);
  assert.match(e.text, /Lager \(Case of 24\): 6 of 7/);
  assert.match(e.text, /Ice \(Each\): none available, 2 declined/);
  assert.match(e.text, /Soda \(Case of 12\): 1\n/);

  const cancelled = orderConfirmedEmail({ ...order, status: "cancelled", cancelReason: "Out of stock" });
  assert.equal(cancelled.subject, "Order #12 was cancelled");
  assert.match(cancelled.text, /Reason: Out of stock/);
});

test("wholesale card fee matches the database's rounding", () => {
  assert.equal(cardFeeCents(11780, 3), 353); // $117.80 at 3% = $3.534 -> $3.53
  assert.equal(cardFeeCents(5890, 3), 177); // $58.90 at 3% = $1.767 -> $1.77
  assert.equal(cardFeeCents(5000, 0), 0);
});
