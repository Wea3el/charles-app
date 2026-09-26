/** Shape every server action returns, so forms can show a message. */
export type ActionResult = { ok: boolean; message: string } | null;

export function fail(message: string): ActionResult {
  return { ok: false, message };
}

export function done(message: string): ActionResult {
  return { ok: true, message };
}

/** Read a trimmed text field; empty becomes null. */
export function text(form: FormData, key: string): string | null {
  const v = form.get(key);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Read a number field; empty becomes null, invalid becomes NaN. */
export function num(form: FormData, key: string): number | null {
  const t = text(form, key);
  if (t === null) return null;
  return Number(t.replace(/[$,]/g, ""));
}
