import { headers } from "next/headers";
import type { Email } from "@/lib/orders";

/**
 * Sends one plain-text email through Resend. Needs EMAIL_API_KEY and
 * EMAIL_FROM; without them it skips quietly. Never throws: an order or
 * approval must not fail because an email didn't go out.
 */
export async function sendEmail(to: string | null | undefined, email: Email): Promise<boolean> {
  const key = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!to) return false;
  if (!key || !from) {
    console.info(`[email skipped: EMAIL_API_KEY/EMAIL_FROM not set] to=${to} subject="${email.subject}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: email.subject, text: email.text }),
    });
    if (!res.ok) console.error(`[email failed] ${res.status} ${await res.text()}`);
    return res.ok;
  } catch (e) {
    console.error("[email failed]", e);
    return false;
  }
}

/** This site's address, for links in emails. */
export async function siteUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
