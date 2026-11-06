import type { EventOutcome, PaymentStatus } from "./types";

// Pure, TOTAL webhook decision (DESIGN §3.2.1). Every input maps to exactly one
// outcome. Evaluated top-to-bottom; the first matching rule wins. APPLY is
// reachable ONLY via rule 3 and ONLY for {PAID, FAILED, CANCELLED}, so no mapped
// status can drive a row terminal while stranding stock/coupon reservations.
export function resolvePaymentTransition(
  current: PaymentStatus,
  target: PaymentStatus,
  incomingEventId: string,
  storedEventId: string | null,
): EventOutcome {
  // 1. Same event re-delivered (stored id equals incoming) — already applied.
  if (storedEventId !== null && storedEventId === incomingEventId) return "DEDUPE";
  // 2. A PENDING row carrying a stored event id is internally inconsistent
  //    (the write-once guard sets status + event_id together).
  if (current === "PENDING" && storedEventId !== null) return "REJECT";
  // 3. The one guarded terminal transition out of PENDING.
  if (current === "PENDING" && (target === "PAID" || target === "FAILED" || target === "CANCELLED")) return "APPLY";
  // 4. A refund/void before any capture must NOT drive the row terminal; leave it
  //    PENDING so the stale-pending sweep can still reclaim the reservation.
  if (current === "PENDING" && target === "REFUNDED") return "IGNORE";
  // 5. Already terminal: the first terminal event wins; later events are no-ops.
  if (current !== "PENDING") return "IGNORE";
  // 6. Catch-all so the function is provably total.
  return "REJECT";
}
