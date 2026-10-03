"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Corners, Input, Notice } from "@/components/ui";
import { searchProducts } from "@/lib/inventory";
import { cartTotals, formatCents, lineTotal, packPrice, type PriceMode } from "@/lib/pricing";
import {
  addToCart,
  buildSale,
  cashSuggestions,
  parseDiscount,
  resolveScan,
  toCents,
  type RegisterLine,
  type RegisterPack,
  type RegisterProduct,
} from "@/lib/register";
import { pendingSales, queueSale, syncSales, type QueuedSale } from "@/lib/saleQueue";
import { createClient } from "@/lib/supabase/client";
import { cancelCardCheckout, checkCardCheckout, startCardCheckout, type CardResult } from "./actions";

type Phase = "cart" | "cash" | "card" | "done";

interface CardState {
  checkoutId: string | null;
  status: string;
  message: string | null;
}

interface Done {
  totalCents: number;
  changeCents: number | null;
  mode: PriceMode;
}

const newId = () => crypto.randomUUID();

/** Server actions throw when the network is down; turn that into a message. */
async function safely(call: () => Promise<CardResult>): Promise<CardResult> {
  try {
    return await call();
  } catch {
    return { ok: false, message: "No connection to the server. Card payments need internet." };
  }
}

export function Register({ catalog, staffId }: { catalog: RegisterProduct[]; staffId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [lines, setLines] = useState<RegisterLine[]>([]);
  const [mode, setMode] = useState<PriceMode>("cash");
  const [saleDiscountText, setSaleDiscountText] = useState("");
  const [query, setQuery] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<RegisterProduct | null>(null);
  const [phase, setPhase] = useState<Phase>("cart");
  const [saleId, setSaleId] = useState(newId);
  const [tendered, setTendered] = useState("");
  const [card, setCard] = useState<CardState>({ checkoutId: null, status: "", message: null });
  const [done, setDone] = useState<Done | null>(null);
  const [outbox, setOutbox] = useState<QueuedSale[]>([]);
  const [online, setOnline] = useState(true);
  const scanRef = useRef<HTMLInputElement>(null);

  const saleDiscount = parseDiscount(saleDiscountText);
  const totals = cartTotals(lines, mode, saleDiscount === "invalid" ? undefined : saleDiscount);
  const results = searchProducts(catalog, query, 6);

  // ---- sync -------------------------------------------------------------
  const sync = useCallback(async () => {
    const r = await syncSales(supabase);
    setOnline(r.reached && navigator.onLine);
    setOutbox(pendingSales());
  }, [supabase]);

  useEffect(() => {
    // Read what's waiting from a previous session, then keep sending.
    const first = setTimeout(sync, 0);
    const timer = setInterval(sync, 30_000);
    const up = () => void sync();
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, [sync]);

  // Keep the scanner aimed at the scan box while ringing up.
  useEffect(() => {
    if (phase === "cart" && !choosing) scanRef.current?.focus();
  }, [phase, choosing, lines.length]);

  // ---- cart -------------------------------------------------------------
  const add = (product: RegisterProduct, pack: RegisterPack) => {
    setLines((ls) => addToCart(ls, product, pack, newId()));
    setChoosing(null);
    setQuery("");
    setScanMessage(null);
  };

  const onScan = () => {
    const hit = resolveScan(catalog, query);
    if (hit?.pack) return add(hit.product, hit.pack);
    if (hit) {
      setChoosing(hit.product);
      setQuery("");
      return;
    }
    if (results.length === 1) {
      const only = results[0];
      if (only.packs.length === 1) return add(only, only.packs[0]);
      setChoosing(only);
      setQuery("");
      return;
    }
    if (/^\d{6,}$/.test(query.trim())) setScanMessage("That barcode isn't on any product. Add it on the product's page.");
  };

  const setQty = (key: string, qty: number) =>
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.key !== key) : ls.map((l) => (l.key === key ? { ...l, quantity: qty } : l))));

  const setLineDiscount = (key: string, text: string) => {
    const d = parseDiscount(text);
    if (d === "invalid") return false;
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, discount: d } : l)));
    return true;
  };

  const clearSale = () => {
    setLines([]);
    setSaleDiscountText("");
    setTendered("");
    setCard({ checkoutId: null, status: "", message: null });
    setSaleId(newId());
    setDone(null);
    setPhase("cart");
  };

  // ---- finishing --------------------------------------------------------
  const finish = (extra: { cashTenderedCents?: number; squareCheckoutId?: string | null; squarePaymentId?: string | null }) => {
    const payload = buildSale(lines, mode, saleDiscount === "invalid" ? undefined : saleDiscount, {
      clientId: saleId,
      staffId,
      offline: !online,
      ...extra,
    });
    queueSale(payload);
    setOutbox(pendingSales());
    setDone({
      totalCents: payload.total_cents,
      changeCents: extra.cashTenderedCents != null ? extra.cashTenderedCents - payload.total_cents : null,
      mode,
    });
    setPhase("done");
    void sync();
  };

  const tenderedCents = tendered.trim() === "" ? null : toCents(tendered.replace(/[$,]/g, ""));
  const cashOk = tenderedCents !== null && !Number.isNaN(tenderedCents) && tenderedCents >= totals.totalCents;

  // ---- card on the Square Terminal --------------------------------------
  const startCard = async () => {
    setPhase("card");
    setCard({ checkoutId: null, status: "sending", message: null });
    const r = await safely(() => startCardCheckout(saleId, totals.totalCents));
    if (!r.ok) return setCard({ checkoutId: null, status: "failed", message: r.message });
    setCard({ checkoutId: r.checkoutId, status: r.status, message: null });
  };

  useEffect(() => {
    if (phase !== "card" || !card.checkoutId || ["completed", "canceled"].includes(card.status)) return;
    const t = setTimeout(async () => {
      const r = await safely(() => checkCardCheckout(card.checkoutId!));
      if (!r.ok) return setCard((c) => ({ ...c, message: r.message }));
      if (r.status === "completed") {
        finish({ squareCheckoutId: r.squareCheckoutId, squarePaymentId: r.paymentId });
        return;
      }
      setCard((c) => ({ ...c, status: r.status, message: r.status === "canceled" ? "The card payment was canceled." : null }));
    }, 2000);
    return () => clearTimeout(t);
    // finish reads the current cart; the poll only needs to restart when the checkout changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, card]);

  const cancelCard = async () => {
    if (!card.checkoutId) return setPhase("cart");
    const id = card.checkoutId;
    const r = await safely(() => cancelCardCheckout(id));
    setCard((c) => ({ ...c, status: r.ok ? r.status : c.status, message: r.ok ? "Canceling on the terminal..." : r.message }));
  };

  const cardPaidByHand = () => {
    if (confirm(`Only do this if ${formatCents(totals.totalCents)} was approved on the terminal. Record it as a card sale?`)) finish({});
  };

  // ---- render -----------------------------------------------------------
  const refused = outbox.filter((s) => s.error);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="flex min-w-0 flex-col gap-4">
        <StatusBar online={online} waiting={outbox.length} refused={refused.length} onSync={sync} />
        {refused.map((s) => (
          <Notice key={s.payload.client_id} ok={false}>
            A sale from {new Date(s.payload.sold_at).toLocaleString()} ({formatCents(s.payload.total_cents)}) was not accepted: {s.error}. It is
            kept on this laptop; ask a manager.
          </Notice>
        ))}

        {phase === "cart" && !choosing && (
          <div className="relative">
            <Input
              ref={scanRef}
              placeholder="Scan an item or type a name"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setScanMessage(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onScan();
                }
              }}
              className="!min-h-14 !text-lg"
              aria-label="Scan or search"
            />
            {scanMessage && <p className="mt-1 mb-0 text-sm font-semibold text-(--color-accent-900)">{scanMessage}</p>}
            {results.length > 0 && (
              <ul className="absolute z-10 mt-1 w-full overflow-hidden border border-(--color-divider) bg-(--color-bg)">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="block min-h-11 w-full px-3 py-2 text-left hover:bg-(--color-accent-100)"
                      onClick={() => {
                        if (p.packs.length === 1) return add(p, p.packs[0]);
                        setChoosing(p);
                        setQuery("");
                      }}
                    >
                      {p.name}
                      <span className="ml-2 text-xs text-(--color-neutral-700)">from {formatCents(packPrice(p.packs[0], mode))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {choosing && <PackChooser product={choosing} mode={mode} onPick={(p) => add(choosing, p)} onClose={() => setChoosing(null)} />}

        {lines.length === 0 ? (
          <p className="m-0 border border-dashed border-(--color-divider) p-8 text-center text-(--color-neutral-700)">
            Scan the first item to start a sale.
          </p>
        ) : (
          <ul className="divide-y divide-(--color-divider) border border-(--color-divider)">
            {lines.map((l) => (
              <CartRow
                key={l.key}
                line={l}
                mode={mode}
                editable={phase === "cart"}
                onQty={(q) => setQty(l.key, q)}
                onDiscount={(t) => setLineDiscount(l.key, t)}
              />
            ))}
          </ul>
        )}
      </section>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
        <div className="grid grid-cols-2 border border-(--color-divider)" role="radiogroup" aria-label="Price">
          {(["cash", "card"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              disabled={phase !== "cart"}
              onClick={() => setMode(m)}
              className={`min-h-14 font-(family-name:--font-heading) text-[19px] font-semibold capitalize disabled:cursor-not-allowed ${mode === m ? "bg-(--color-accent) text-(--color-bg)" : "text-(--color-neutral-700) enabled:hover:bg-(--color-accent-100)"}`}
            >
              {m} price
            </button>
          ))}
        </div>

        <Card className="flex flex-col gap-1">
          <Row label={`Items (${totals.singlesUsed} single${totals.singlesUsed === 1 ? "" : "s"})`} value={formatCents(totals.subtotalCents)} />
          {phase === "cart" ? (
            <label className="flex items-center justify-between gap-3 py-1 text-sm">
              <span>Sale discount</span>
              <Input
                value={saleDiscountText}
                onChange={(e) => setSaleDiscountText(e.target.value)}
                placeholder="10% or 2.00"
                className={`!w-28 text-right ${saleDiscount === "invalid" ? "!border-(--color-accent-900)" : ""}`}
              />
            </label>
          ) : null}
          {totals.orderDiscountCents > 0 && <Row label="Discount" value={`−${formatCents(totals.orderDiscountCents)}`} />}
          <div className="flex items-baseline justify-between border-t border-(--color-divider) pt-2">
            <span className="font-semibold">Total</span>
            <span className="font-(family-name:--font-heading) text-4xl font-semibold tabular-nums">{formatCents(totals.totalCents)}</span>
          </div>
        </Card>

        {phase === "cart" && (
          <div className="flex flex-col gap-2">
            <Button
              className="w-full !min-h-14 !text-[19px]"
              disabled={lines.length === 0 || saleDiscount === "invalid"}
              onClick={() => (mode === "cash" ? setPhase("cash") : void startCard())}
            >
              {mode === "cash" ? "Take cash" : online ? "Charge card on terminal" : "Charge card"}
            </Button>
            {lines.length > 0 && (
              <Button variant="secondary" className="w-full" onClick={() => confirm("Clear this sale?") && clearSale()}>
                Clear sale
              </Button>
            )}
          </div>
        )}

        {phase === "cash" && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (cashOk) finish({ cashTenderedCents: tenderedCents! });
            }}
          >
            <label className="block text-sm font-medium">
              Cash given
              <Input
                autoFocus
                inputMode="decimal"
                value={tendered}
                onChange={(e) => setTendered(e.target.value)}
                placeholder="0.00"
                className="mt-1 !text-2xl"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {cashSuggestions(totals.totalCents).map((c) => (
                <Button key={c} type="button" variant="secondary" onClick={() => setTendered((c / 100).toFixed(2))}>
                  {c === totals.totalCents ? "Exact" : formatCents(c)}
                </Button>
              ))}
            </div>
            {cashOk && (
              <p className="m-0 text-lg">
                Change: <strong className="font-(family-name:--font-heading) text-3xl font-semibold">{formatCents(tenderedCents! - totals.totalCents)}</strong>
              </p>
            )}
            <Button className="w-full !min-h-14 !text-[19px]" disabled={!cashOk}>
              Complete sale
            </Button>
            <Button type="button" variant="secondary" className="w-full" onClick={() => setPhase("cart")}>
              Back
            </Button>
          </form>
        )}

        {phase === "card" && (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-lg font-semibold">
              {card.status === "sending"
                ? "Sending to the terminal..."
                : card.status === "failed"
                  ? "Could not reach the terminal"
                  : card.status === "canceled"
                    ? "Canceled"
                    : card.status === "in_progress"
                      ? "Customer is paying on the terminal..."
                      : "Waiting for the customer to tap, insert or swipe..."}
            </p>
            {card.message && <Notice ok={false}>{card.message}</Notice>}
            {card.checkoutId && !["canceled", "completed"].includes(card.status) && (
              <Button variant="secondary" className="w-full" onClick={cancelCard}>
                Cancel on terminal
              </Button>
            )}
            {(card.status === "failed" || card.status === "canceled") && (
              <>
                <Button variant="secondary" className="w-full" onClick={startCard}>
                  Try again
                </Button>
                <Button variant="secondary" className="w-full" onClick={cardPaidByHand}>
                  Card paid on terminal
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => setPhase("cart")}>
                  Back to sale
                </Button>
              </>
            )}
          </div>
        )}

        {phase === "done" && done && (
          <div role="status" className="flex flex-col gap-3 border border-(--color-accent-300) bg-(--color-accent-100) p-4 text-(--color-accent-900)">
            <p className="m-0 text-lg font-semibold">
              Sale complete · {done.mode} · {formatCents(done.totalCents)}
            </p>
            {done.changeCents !== null && (
              <p className="m-0">
                Change due: <strong className="font-(family-name:--font-heading) text-4xl font-semibold">{formatCents(done.changeCents)}</strong>
              </p>
            )}
            <Button autoFocus className="w-full !min-h-14 !text-[19px]" onClick={clearSale}>
              New sale
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}

function StatusBar({ online, waiting, refused, onSync }: { online: boolean; waiting: number; refused: number; onSync: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span
        className={`inline-flex items-center gap-2 border px-3 py-1 font-medium ${
          online ? "border-(--color-divider) text-(--color-neutral-700)" : "border-(--color-accent) font-semibold text-(--color-accent-900)"
        }`}
      >
        <span className={`h-2 w-2 ${online ? "bg-(--color-accent)" : "border border-(--color-accent-900)"}`} />
        {online ? "Online" : "Offline: sales are saved on this laptop"}
      </span>
      {waiting > 0 && (
        <>
          <span className="text-(--color-neutral-700)">
            {waiting - refused} sale{waiting - refused === 1 ? "" : "s"} waiting to sync
          </span>
          <Button type="button" variant="ghost" onClick={onSync}>
            Sync now
          </Button>
        </>
      )}
    </div>
  );
}

function PackChooser({
  product,
  mode,
  onPick,
  onClose,
}: {
  product: RegisterProduct;
  mode: PriceMode;
  onPick: (p: RegisterPack) => void;
  onClose: () => void;
}) {
  // The first pack has focus: Enter picks it, Tab/arrows move, Escape closes.
  return (
    <div
      className="blueprint p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          const buttons = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-pack]")];
          const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(i + (e.key === "ArrowRight" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
        }
      }}
    >
      <Corners />
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="!m-0 !text-[20px]">{product.name}: which pack?</h2>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {product.packs.map((p, i) => (
          <button
            key={p.id}
            type="button"
            data-pack
            autoFocus={i === 0}
            onClick={() => onPick(p)}
            className="flex min-h-14 flex-col justify-center border border-(--color-divider) p-3 text-left hover:bg-(--color-accent-100)"
          >
            <span className="block font-semibold">{p.label}</span>
            <span className="text-sm tabular-nums">{formatCents(packPrice(p, mode))}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function CartRow({
  line,
  mode,
  editable,
  onQty,
  onDiscount,
}: {
  line: RegisterLine;
  mode: PriceMode;
  editable: boolean;
  onQty: (q: number) => void;
  onDiscount: (text: string) => boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [bad, setBad] = useState(false);
  const gross = packPrice(line.pack, mode) * line.quantity;
  const net = lineTotal(line, mode);

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="font-medium">{line.product.name}</div>
        <div className="text-sm text-(--color-neutral-700)">
          {line.pack.label} · {formatCents(packPrice(line.pack, mode))} each
          {line.discount && (
            <span className="ml-2 font-semibold text-(--color-accent-700)">
              −{line.discount.kind === "percent" ? `${line.discount.value}%` : formatCents(line.discount.cents)}
            </span>
          )}
        </div>
      </div>
      {editable ? (
        <div className="flex items-center gap-1">
          <Button variant="secondary" className="!px-3" onClick={() => onQty(line.quantity - 1)} aria-label="One less">
            −
          </Button>
          <span className="w-8 text-center tabular-nums">{line.quantity}</span>
          <Button variant="secondary" className="!px-3" onClick={() => onQty(line.quantity + 1)} aria-label="One more">
            +
          </Button>
        </div>
      ) : (
        <span className="tabular-nums">×{line.quantity}</span>
      )}
      <div className="w-24 text-right tabular-nums">
        {net !== gross && <div className="text-xs text-(--color-neutral-700) line-through">{formatCents(gross)}</div>}
        <div className="font-semibold">{formatCents(net)}</div>
      </div>
      {editable && (
        <div className="basis-full">
          {editing ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (onDiscount(text)) {
                  setEditing(false);
                  setBad(false);
                } else setBad(true);
              }}
            >
              <Input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="10% or 1.00, blank to remove"
                className={`!w-56 ${bad ? "!border-(--color-accent-900)" : ""}`}
              />
              <Button>Apply</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </form>
          ) : (
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
              {line.discount ? "Change discount" : "Discount this line"}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
