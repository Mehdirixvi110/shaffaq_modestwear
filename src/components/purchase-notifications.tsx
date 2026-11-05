"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  buildNotificationPool,
  randomBetween,
  FIRST_DELAY_MIN_MS,
  FIRST_DELAY_MAX_MS,
  INTERVAL_MIN_MS,
  INTERVAL_MAX_MS,
  VISIBLE_MS,
  type PurchaseNotification,
} from "@/lib/social-proof";

export function PurchaseNotifications() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const [current, setCurrent] = useState<PurchaseNotification | null>(null);
  const poolRef = useRef<PurchaseNotification[]>([]);
  const indexRef = useRef(0);

  useEffect(() => {
    if (isAdmin) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    function showNext() {
      const pool = poolRef.current;
      if (pool.length === 0) return;
      const entry = pool[indexRef.current % pool.length];
      indexRef.current += 1;
      setCurrent(entry);
      timers.push(setTimeout(() => {
        if (!cancelled) setCurrent(null);
      }, VISIBLE_MS));
      timers.push(setTimeout(showNext, randomBetween(INTERVAL_MIN_MS, INTERVAL_MAX_MS)));
    }

    (async () => {
      try {
        const response = await fetch("/api/purchase-feed", { headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const data = (await response.json()) as { products?: string[] };
        if (cancelled) return;
        poolRef.current = buildNotificationPool(data.products ?? []);
        if (poolRef.current.length === 0) return;
        timers.push(setTimeout(showNext, randomBetween(FIRST_DELAY_MIN_MS, FIRST_DELAY_MAX_MS)));
      } catch {
        // Social proof is non-essential; ignore feed failures.
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [isAdmin]);

  if (isAdmin || !current) return null;

  return (
    <div className="purchase-note" role="status" aria-live="polite">
      <div className="purchase-note__body">
        <p className="purchase-note__text">
          <strong>{current.name}</strong> from {current.city} purchased <strong>{current.product}</strong>
        </p>
        <button
          type="button"
          className="purchase-note__close"
          aria-label="Dismiss notification"
          onClick={() => setCurrent(null)}
        >
          ×
        </button>
      </div>
    </div>
  );
}
