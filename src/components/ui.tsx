import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full rounded-lg border border-black/15 bg-background px-3 py-2 text-base outline-none focus:border-black/50 focus:ring-2 focus:ring-black/10 dark:border-white/20 dark:focus:border-white/60";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${control} font-mono text-sm ${props.className ?? ""}`} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs opacity-60">{hint}</span>}
    </label>
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: "primary" | "secondary" | "danger" };

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const styles = {
    primary: "bg-foreground text-background hover:opacity-90",
    secondary: "border border-black/15 hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10",
    danger: "bg-red-700 text-white hover:bg-red-800",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${styles} ${className ?? ""}`}
    />
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-black/10 p-4 dark:border-white/15 ${className ?? ""}`}>{children}</div>
  );
}

export function Notice({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p
      role={ok ? "status" : "alert"}
      className={`rounded-lg px-3 py-2 text-sm ${
        ok
          ? "bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100"
          : "bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100"
      }`}
    >
      {children}
    </p>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "retail" | "warehouse" | "warn" }) {
  const styles = {
    neutral: "bg-black/5 dark:bg-white/10",
    retail: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100",
    warehouse: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
    warn: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
  }[tone];
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>{children}</span>;
}

export function unitLabel(catalog: "retail" | "warehouse", qty: number) {
  const unit = catalog === "retail" ? "single" : "case";
  return `${qty} ${unit}${qty === 1 ? "" : "s"}`;
}
