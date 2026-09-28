/**
 * Sales waiting to reach the database, kept in the laptop's browser storage.
 * Every sale goes through here, online or not: it is saved first, then sent.
 * record_sale() ignores a client_id it already has, so resending is safe.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { RecordSalePayload } from "@/lib/register";

const KEY = "register.outbox.v1";

export interface QueuedSale {
  payload: RecordSalePayload;
  queuedAt: string;
  /** Set when the database refused the sale (not for a lost connection). */
  error?: string;
}

function read(): QueuedSale[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function write(sales: QueuedSale[]) {
  // If storage is blocked the sale still syncs now; it just would not survive a reload.
  try {
    localStorage.setItem(KEY, JSON.stringify(sales));
  } catch {}
}

export function pendingSales(): QueuedSale[] {
  return read();
}

export function queueSale(payload: RecordSalePayload) {
  write([...read().filter((s) => s.payload.client_id !== payload.client_id), { payload, queuedAt: new Date().toISOString() }]);
}

/** Give up on a sale the database refused (a manager decides to drop it). */
export function discardSale(clientId: string) {
  write(read().filter((s) => s.payload.client_id !== clientId));
}

export interface SyncResult {
  synced: number;
  refused: number;
  /** False when the server could not be reached. */
  reached: boolean;
}

let running: Promise<SyncResult> | null = null;

/** Send every waiting sale, oldest first. Only one sync runs at a time. */
export function syncSales(supabase: SupabaseClient<Database>): Promise<SyncResult> {
  running ??= (async () => {
    const result: SyncResult = { synced: 0, refused: 0, reached: true };
    try {
      for (const sale of read()) {
        const { error } = await supabase.rpc("record_sale", { p_sale: sale.payload as never });
        if (!error) {
          discardSale(sale.payload.client_id);
          result.synced++;
        } else if (!error.code) {
          // No Postgres error code: the request never got an answer. Try later.
          result.reached = false;
          break;
        } else {
          write(read().map((s) => (s.payload.client_id === sale.payload.client_id ? { ...s, error: error.message } : s)));
          result.refused++;
        }
      }
    } catch {
      result.reached = false;
    }
    return result;
  })().finally(() => {
    running = null;
  });
  return running;
}
