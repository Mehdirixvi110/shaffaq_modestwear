import type { CreateCheckoutResult, PaymentProvider, VerifiedEvent } from "@/lib/payments/types";
import { PaymentSignatureError } from "./provider";

// COD conformance shim — makes the PaymentProvider abstraction total WITHOUT
// altering the COD path. The COD checkout never routes through this adapter and
// writes no payments row (DESIGN §3.3); it stays behaviourally identical to today.
// The 'COD' provider value only reserves the door for a future COD-ledger row.
export const codProvider: PaymentProvider = {
  name: "COD",
  createCheckout(): Promise<CreateCheckoutResult> {
    return Promise.resolve({ kind: "NONE" });
  },
  verifyWebhook(): VerifiedEvent {
    throw new PaymentSignatureError("COD has no webhook channel.");
  },
  mapEventToStatus(): "IGNORE" {
    return "IGNORE";
  },
};
