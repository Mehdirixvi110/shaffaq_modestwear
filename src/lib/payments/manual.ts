// Pure manual (offline bank-transfer) payment helpers. No DB, no env, no network —
// they take a settings-shaped object so they are unit-testable and reusable by the
// checkout page (UI gating), the checkout route (fail-closed server gate), and the
// begin service (account snapshot written into payments.account_snapshot).

export type ManualPaymentSettings = {
  manualPaymentEnabled: number | boolean;
  manualBankName: string | null;
  manualAccountTitle: string | null;
  manualAccountNumber: string | null;
  manualIban: string | null;
  manualEasypaisaNumber: string | null;
  manualJazzcashNumber: string | null;
  manualPaymentInstructions: string | null;
};

// The account details snapshotted at placement and shown to the customer / admin.
// Only configured (non-empty) fields are present.
export type ManualAccountSnapshot = {
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  iban?: string;
  easypaisaNumber?: string;
  jazzcashNumber?: string;
  instructions?: string;
};

function trimmed(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

// Shared eligibility predicate for the three guarded MANUAL proof actions: the
// customer proof upload, admin MARK_MANUAL_PAID, and admin REJECT_MANUAL_PROOF. A
// proof action is allowed only for a storefront bank-transfer order that is still
// UNPAID and not CANCELLED, so a cancelled order rejects all three by construction.
export function manualProofActionable(order: { source: string; paymentStatus: string; orderStatus: string }): boolean {
  return order.source === "STOREFRONT_MANUAL" && order.paymentStatus === "UNPAID" && order.orderStatus !== "CANCELLED";
}

// MANUAL is offered ONLY when enabled AND at least one payable-account identifier
// is configured (title/instructions alone are not enough to receive money).
export function manualPaymentAvailable(settings: ManualPaymentSettings): boolean {
  if (!settings.manualPaymentEnabled) return false;
  return [settings.manualBankName, settings.manualAccountNumber, settings.manualIban, settings.manualEasypaisaNumber, settings.manualJazzcashNumber]
    .some((value) => trimmed(value) !== "");
}

// Freeze the account details shown to the customer at placement so admin
// verification can display exactly what was shown even if settings later change.
export function buildManualAccountSnapshot(settings: ManualPaymentSettings): ManualAccountSnapshot {
  const snapshot: ManualAccountSnapshot = {};
  const add = (key: keyof ManualAccountSnapshot, value: string | null | undefined) => {
    const text = trimmed(value);
    if (text) snapshot[key] = text;
  };
  add("bankName", settings.manualBankName);
  add("accountTitle", settings.manualAccountTitle);
  add("accountNumber", settings.manualAccountNumber);
  add("iban", settings.manualIban);
  add("easypaisaNumber", settings.manualEasypaisaNumber);
  add("jazzcashNumber", settings.manualJazzcashNumber);
  add("instructions", settings.manualPaymentInstructions);
  return snapshot;
}

// Parse a stored account_snapshot JSON string back into a typed object for display.
// Returns an empty object on any malformed/absent input (never throws).
export function parseManualAccountSnapshot(raw: string | null | undefined): ManualAccountSnapshot {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const source = parsed as Record<string, unknown>;
    const snapshot: ManualAccountSnapshot = {};
    for (const key of ["bankName", "accountTitle", "accountNumber", "iban", "easypaisaNumber", "jazzcashNumber", "instructions"] as const) {
      const value = source[key];
      if (typeof value === "string" && value.trim() !== "") snapshot[key] = value;
    }
    return snapshot;
  } catch {
    return {};
  }
}
