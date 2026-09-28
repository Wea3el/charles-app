"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

const KEY = "shop.age21";

/** Asks once per browser. ID is still checked at pickup or delivery. */
export function AgeGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"checking" | "ask" | "ok" | "under">("checking");
  useEffect(() => {
    let ok = false;
    try {
      ok = localStorage.getItem(KEY) === "yes";
    } catch {}
    // What the browser remembers is only known once it is running.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(ok ? "ok" : "ask");
  }, []);

  if (state === "checking") return null;
  if (state === "ok") return <>{children}</>;
  if (state === "under") return <p className="text-lg">Sorry, you must be 21 or older to order.</p>;
  return (
    <div className="max-w-md space-y-4 rounded-xl border border-black/10 p-6 dark:border-white/15">
      <h2 className="text-xl font-semibold">Are you 21 or older?</h2>
      <p className="text-sm opacity-70">We check ID at pickup or delivery.</p>
      <div className="flex gap-3">
        <Button
          onClick={() => {
            try {
              localStorage.setItem(KEY, "yes");
            } catch {}
            setState("ok");
          }}
        >
          Yes, I&apos;m 21+
        </Button>
        <Button variant="secondary" onClick={() => setState("under")}>
          No
        </Button>
      </div>
    </div>
  );
}
