"use client";

import { useEffect } from "react";

/**
 * Installs the service worker that keeps a copy of the register page, so it
 * still opens if the laptop is reloaded without internet. Production only:
 * in development it would cache files that are meant to hot-reload.
 */
export function OfflineReady() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
