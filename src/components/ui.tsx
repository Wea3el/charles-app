import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Check, Minus, Plus, Search, type LucideIcon } from "lucide-react";

/** Registration marks. Every `.blueprint` element needs them. */
export function Corners() {
  return (
    <>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
    </>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`input min-h-12 !text-base ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`input min-h-12 !text-base ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`input font-mono !text-sm ${props.className ?? ""}`} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[5px] block text-xs text-(--color-neutral-700)">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[13px] text-(--color-neutral-700)">{hint}</span>}
    </label>
  );
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANT: Record<Variant, string> = {
  primary: "btn btn-primary blueprint min-h-11 px-4 text-[15px]",
  secondary: "btn btn-secondary min-h-11 px-4 text-[15px]",
  danger: "btn btn-secondary min-h-11 px-4 text-[15px] text-(--color-accent-900)",
  ghost: "btn btn-ghost min-h-11 text-[13px]",
};

type ButtonProps = ComponentProps<"button"> & { variant?: Variant };

export function Button({ variant = "primary", className, children, ...props }: ButtonProps) {
  return (
    <button {...props} className={`${VARIANT[variant]} ${className ?? ""}`}>
      {variant === "primary" && <Corners />}
      {children}
    </button>
  );
}

/** A link that looks like a Button. */
export function ButtonLink({ variant = "secondary", className, children, ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link {...props} className={`${VARIANT[variant]} ${className ?? ""}`}>
      {variant === "primary" && <Corners />}
      {children}
    </Link>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`blueprint p-4 ${className ?? ""}`}>
      <Corners />
      {children}
    </div>
  );
}

export function Notice({ ok, children, action }: { ok: boolean; children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role={ok ? "status" : "alert"}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 border px-4 py-3 text-(--color-accent-900) ${
        ok ? "border-(--color-accent-300) bg-(--color-accent-100)" : "border-(--color-accent) font-semibold"
      }`}
    >
      {ok && <Check size={20} strokeWidth={1.5} className="shrink-0" />}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "retail" | "warehouse" | "warn" }) {
  return <span className={`tag ${tone === "warn" ? "tag-accent" : "tag-neutral"}`}>{children}</span>;
}

export function unitLabel(catalog: "retail" | "warehouse", qty: number) {
  const unit = catalog === "retail" ? "single" : "case";
  return `${qty} ${unit}${qty === 1 ? "" : "s"}`;
}

/** Page wrapper inside a shell: optional h1 and lead line, then the content. */
export function PageShell({ title, lead, children }: { title?: string; lead?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      {(title || lead) && (
        <div className="flex flex-col gap-1.5">
          {title && <h1 className="!m-0 !text-[36px]">{title}</h1>}
          {lead && <p className="!m-0 max-w-[720px] text-(--color-neutral-700)">{lead}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function BigTile({
  href,
  icon: Icon,
  title,
  body,
  badge,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  body: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="blueprint flex min-h-[150px] flex-col items-start gap-3.5 p-[18px] !text-(--color-text) !no-underline hover:bg-(--color-accent-100)"
    >
      <Corners />
      <span className="flex w-full items-center gap-2.5">
        <Icon size={30} strokeWidth={1.5} className="text-(--color-accent)" />
        {badge && <span className="tag tag-accent ml-auto !text-[13px]">{badge}</span>}
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-(family-name:--font-heading) text-[21px] leading-[1.1] font-semibold">{title}</span>
        <span className="text-[13px] text-(--color-neutral-700)">{body}</span>
      </span>
    </Link>
  );
}

export function StepHeading({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-[26px] place-items-center border border-(--color-accent) font-(family-name:--font-heading) font-semibold text-(--color-accent-700)">
        {n}
      </span>
      <h4 className="!m-0">{children}</h4>
    </div>
  );
}

export interface Choice {
  id: string;
  name: string;
  sub?: string;
  disabled?: boolean;
}

/** Big tap targets in place of a <select>. */
export function ChoiceGrid({
  options,
  value,
  onChange,
  min = 150,
}: {
  options: Choice[];
  value: string;
  onChange: (id: string) => void;
  min?: number;
}) {
  return (
    <div className="grid gap-2.5" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))` }}>
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            disabled={o.disabled}
            aria-pressed={selected}
            onClick={() => onChange(o.id)}
            className={`flex min-h-14 flex-col justify-center gap-0.5 border px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-45 ${
              selected ? "border-(--color-accent) bg-(--color-accent-100)" : "border-(--color-divider) hover:bg-(--color-accent-100)"
            }`}
          >
            <span className="font-semibold">{o.name}</span>
            {o.sub && <span className="text-[13px] text-(--color-neutral-700)">{o.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}

const STEPPER = {
  lg: { btn: "size-14", icon: 22, num: "h-14 w-24 text-[28px]" },
  md: { btn: "size-11", icon: 18, num: "h-11 w-10 text-[20px]" },
  sm: { btn: "size-9", icon: 16, num: "h-9 w-8 text-[15px]" },
};

/** − number +, joined. The large size has an editable number (named `name` for forms). */
export function Stepper({
  value,
  onChange,
  size = "md",
  min = 0,
  name,
}: {
  value: number;
  onChange: (n: number) => void;
  size?: keyof typeof STEPPER;
  min?: number;
  name?: string;
}) {
  const s = STEPPER[size];
  const btn = `btn btn-secondary !p-0 shrink-0 ${s.btn}`;
  return (
    <span className="flex shrink-0 items-center">
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} aria-label="One less">
        <Minus size={s.icon} strokeWidth={1.5} />
      </button>
      {size === "lg" ? (
        <input
          name={name}
          inputMode="numeric"
          aria-label="Quantity"
          value={value}
          onChange={(e) => onChange(Math.max(min, parseInt(e.target.value, 10) || 0))}
          className={`border-y border-(--color-divider) bg-(--color-surface) text-center font-(family-name:--font-heading) font-semibold tabular-nums ${s.num}`}
        />
      ) : (
        <span className={`grid place-items-center border-y border-(--color-divider) font-(family-name:--font-heading) font-semibold tabular-nums ${s.num}`}>
          {value}
        </span>
      )}
      <button type="button" className={btn} onClick={() => onChange(value + 1)} aria-label="One more">
        <Plus size={s.icon} strokeWidth={1.5} />
      </button>
    </span>
  );
}

/** The 56px search bar with an icon and a Clear button. */
export function SearchField({
  value,
  onChange,
  placeholder,
  accent,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  accent?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label
      className={`flex min-h-14 items-center gap-3 border bg-(--color-surface) px-4 ${accent ? "border-(--color-accent)" : "border-(--color-divider)"}`}
    >
      <Search size={22} strokeWidth={1.5} className="shrink-0 text-(--color-accent)" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoFocus={autoFocus}
        className="min-w-0 flex-1 bg-transparent text-lg outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" className="btn btn-ghost" onClick={() => onChange("")}>
          Clear
        </button>
      )}
    </label>
  );
}
