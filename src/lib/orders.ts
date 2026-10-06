/**
 * Online order logic shared by the shop and the store app (unit tested):
 * which days can be picked in store time, status wording, and email text.
 */

export type OrderKind = "wholesale" | "retail";
export type OrderStatus = "submitted" | "confirmed" | "partially_confirmed" | "cancelled" | "completed";
export type LineStatus = "pending" | "confirmed" | "partial" | "declined";
export type PaymentMethod = "cash" | "check" | "card" | "zelle" | "invoice";

export interface ShopSettings {
  sameDayCutoff: string; // "15:00:00"
  daysAhead: number; // today counts as day 1
  timeZone: string;
  cardFeePercent: number; // wholesale, paying online by card
}

export const DEFAULT_SHOP_SETTINGS: ShopSettings = { sameDayCutoff: "15:00:00", daysAhead: 5, timeZone: "America/New_York", cardFeePercent: 0 };

export const PAYMENT_METHODS: Record<OrderKind, { id: PaymentMethod; name: string }[]> = {
  wholesale: [
    { id: "cash", name: "Cash" },
    { id: "check", name: "Check" },
    { id: "card", name: "Card" },
    { id: "zelle", name: "Zelle" },
    { id: "invoice", name: "Invoice" },
  ],
  retail: [
    { id: "cash", name: "Cash" },
    { id: "card", name: "Card" },
  ],
};

export const paymentName = (m: string | null) => PAYMENT_METHODS.wholesale.find((p) => p.id === m)?.name ?? "Not chosen";

/** Checkout choice that means "card, paid now on Square's page". */
export const PAY_ONLINE = { id: "online", name: "Pay now online", sub: "Card, Apple Pay, Google Pay" } as const;

/** Wholesale card fee on an amount, rounded like the database (to the cent, halves up). */
export const cardFeeCents = (amountCents: number, percent: number) => (percent > 0 ? Math.round((amountCents * percent) / 100) : 0);

/** Date (YYYY-MM-DD) and minutes past midnight right now in the store's time zone. */
export function storeClock(now: Date, timeZone: string): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const cutoffMinutes = (cutoff: string) => {
  const [h, m] = cutoff.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** "3 PM", "3:30 PM" */
export function cutoffText(cutoff: string): string {
  const [h, m] = cutoff.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h >= 12 ? "PM" : "AM"}`;
}

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
const shortDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export interface OrderDay {
  id: string; // YYYY-MM-DD
  name: string;
  sub: string;
  disabled: boolean;
}

/** The days a customer can pick, in store time. Today closes at the same-day cutoff. */
export function orderDays(now: Date, s: ShopSettings): OrderDay[] {
  const clock = storeClock(now, s.timeZone);
  const closed = clock.minutes >= cutoffMinutes(s.sameDayCutoff);
  return Array.from({ length: s.daysAhead }, (_, i) => {
    const date = addDays(clock.date, i);
    const off = i === 0 && closed;
    return {
      id: date,
      name: i === 0 ? "Today" : i === 1 ? "Tomorrow" : weekday(date),
      sub: off ? `Closed after ${cutoffText(s.sameDayCutoff)}` : shortDate(date),
      disabled: off,
    };
  });
}

/** "today", "tomorrow", "on Friday", or "on Oct 14" further out. */
export function dayPhrase(date: string, today: string): string {
  if (date === today) return "today";
  if (date === addDays(today, 1)) return "tomorrow";
  if (date > today && date <= addDays(today, 6)) return `on ${weekday(date)}`;
  return `on ${shortDate(date)}`;
}

/** Words customers see. */
export const STATUS_TEXT: Record<OrderStatus, string> = {
  submitted: "Waiting for the store to confirm",
  confirmed: "Confirmed",
  partially_confirmed: "Confirmed, some items short",
  cancelled: "Cancelled",
  completed: "Done",
};

/** Short words for staff lists. */
export const STATUS_TAG: Record<OrderStatus, string> = {
  submitted: "new",
  confirmed: "confirmed",
  partially_confirmed: "part filled",
  cancelled: "cancelled",
  completed: "done",
};

export const unitWord = (kind: OrderKind, n: number) => `${n} ${kind === "wholesale" ? "case" : "item"}${n === 1 ? "" : "s"}`;

export interface EmailLine {
  name: string;
  label: string;
  requested: number;
  confirmed: number | null;
  status: LineStatus;
}

export interface EmailOrder {
  number: number;
  kind: OrderKind;
  date: string;
  today: string;
  total: string; // formatted money
  lines: EmailLine[];
  accountUrl?: string; // guests have no orders page
  payUrl?: string; // paying online and not paid yet
  cancelReason?: string | null;
}

const fulfil = (o: Pick<EmailOrder, "kind" | "date" | "today">) =>
  `${o.kind === "wholesale" ? "delivery" : "pickup"} ${dayPhrase(o.date, o.today)}`;

const yourOrders = (o: EmailOrder) => (o.accountUrl ? [`Your orders: ${o.accountUrl}`] : []);

const lineText = (l: EmailLine) => {
  const base = `${l.name} (${l.label})`;
  if (l.status === "declined") return `- ${base}: none available, ${l.requested} declined`;
  if (l.status === "partial") return `- ${base}: ${l.confirmed} of ${l.requested}`;
  return `- ${base}: ${l.confirmed ?? l.requested}`;
};

export interface Email {
  subject: string;
  text: string;
}

export function orderReceivedEmail(o: EmailOrder): Email {
  return {
    subject: `We got your order #${o.number}`,
    text: [
      `Thanks! Order #${o.number} is in for ${fulfil(o)}.`,
      "",
      ...o.lines.map(lineText),
      "",
      `Estimated total: ${o.total}`,
      ...(o.payUrl ? ["", `Not paid yet? Finish paying here: ${o.payUrl}`, "If anything is short, the difference goes back to your card."] : []),
      "",
      "We'll email you again once the store confirms it. Items that are low or out may be partly filled or declined.",
      ...yourOrders(o),
    ].join("\n"),
  };
}

export function orderConfirmedEmail(o: EmailOrder & { status: OrderStatus }): Email {
  const short = o.lines.some((l) => l.status !== "confirmed");
  if (o.status === "cancelled") {
    return {
      subject: `Order #${o.number} was cancelled`,
      text: [
        `Sorry, we can't fill order #${o.number} for ${fulfil(o)}.`,
        ...(o.cancelReason ? ["", `Reason: ${o.cancelReason}`] : []),
        "",
        "Call the store if you have questions.",
        ...yourOrders(o),
      ].join("\n"),
    };
  }
  return {
    subject: short ? `Order #${o.number} confirmed, some items short` : `Order #${o.number} confirmed`,
    text: [
      `Order #${o.number} is confirmed for ${fulfil(o)}.`,
      ...(short ? ["Some items were short, so we filled what we could:"] : []),
      "",
      ...o.lines.map(lineText),
      "",
      `Total: ${o.total}`,
      ...yourOrders(o),
    ].join("\n"),
  };
}

export function accountApprovedEmail(name: string, shopUrl: string): Email {
  return {
    subject: "Your business account is approved",
    text: [`Hi ${name},`, "", "Your wholesale account is approved. Sign in to see case prices and place orders:", shopUrl].join("\n"),
  };
}
