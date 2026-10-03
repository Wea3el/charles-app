"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, Corners } from "@/components/ui";

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
  if (state === "under") return <p className="!m-0 text-xl">Sorry, you must be 21 or older to order.</p>;
  return (
    <div className="blueprint flex max-w-[480px] flex-col gap-4 p-7">
      <Corners />
      <h2 className="!m-0 !text-[32px]">Are you 21 or older?</h2>
      <p className="!m-0 text-(--color-neutral-700)">We check ID at pickup or delivery.</p>
      <div className="grid grid-cols-2 gap-3">
        <Button
          className="min-h-14 !text-lg"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "yes");
            } catch {}
            setState("ok");
          }}
        >
          Yes, I&apos;m 21+
        </Button>
        <Button variant="secondary" className="min-h-14 !text-lg" onClick={() => setState("under")}>
          No
        </Button>
      </div>
    </div>
  );
}
