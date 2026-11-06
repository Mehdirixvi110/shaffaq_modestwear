// Server-authoritative money normalisation. The server treats money as integer
// PKR rupees everywhere; the provider amount is only ever derived from, or
// reconciled against, that integer total — never trusted as an input.
//
// A-7: Safepay documents PKR amounts in BASE/MINOR units ("PKR 100 = 10000"),
// i.e. rupees x 100. SAFEPAY_AMOUNT_SUBUNITS captures that; both the major-unit
// (identity) and minor-unit (x100) branches are covered by unit tests, so a
// future API-version change is a one-line flip with the tests already proving it.
export const SAFEPAY_AMOUNT_SUBUNITS = 100;

function assertSafeInteger(value: number, code: string): void {
  if (!Number.isSafeInteger(value)) throw new Error(code);
}

// PKR rupees -> provider units.
export function toProviderAmount(totalPkr: number, subunits: number = SAFEPAY_AMOUNT_SUBUNITS): number {
  assertSafeInteger(totalPkr, "PAYMENT_AMOUNT_NOT_INTEGER");
  if (totalPkr < 0) throw new Error("PAYMENT_AMOUNT_NEGATIVE");
  const provider = totalPkr * subunits;
  assertSafeInteger(provider, "MONEY_RANGE_EXCEEDED");
  return provider;
}

// Provider units -> PKR rupees. Rejects a value that does not map to an exact
// integer number of rupees (e.g. a stray fractional minor-unit amount).
export function fromProviderAmount(providerAmount: number, subunits: number = SAFEPAY_AMOUNT_SUBUNITS): number {
  if (typeof providerAmount !== "number" || !Number.isFinite(providerAmount)) throw new Error("PAYMENT_AMOUNT_INVALID");
  const pkr = providerAmount / subunits;
  if (!Number.isInteger(pkr)) throw new Error("PAYMENT_AMOUNT_NOT_INTEGER");
  assertSafeInteger(pkr, "MONEY_RANGE_EXCEEDED");
  return pkr;
}

// Reconcile a provider event's amount/currency against the server order total.
// Throws on any mismatch; returns nothing on success. Callers reconcile ONLY on
// a capture (PAID) event — failure/cancel/expiry events routinely omit or vary
// the amount and must not be reconciled (they still release stock).
export function reconcilePaymentAmount(orderTotalPkr: number, eventAmount: number | null, eventCurrency: string | null): void {
  if (eventCurrency !== "PKR") throw new Error("PAYMENT_CURRENCY_MISMATCH");
  if (eventAmount === null || eventAmount === undefined) throw new Error("PAYMENT_AMOUNT_MISSING");
  const pkr = fromProviderAmount(eventAmount);
  if (pkr !== orderTotalPkr) throw new Error("PAYMENT_AMOUNT_MISMATCH");
}
