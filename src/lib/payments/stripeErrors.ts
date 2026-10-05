import type { StripeError } from "@stripe/stripe-js";

/** An order edit cancelled the intent this page was opened with. */
export function isCancelledIntentError(error: StripeError): boolean {
  return error.code === "payment_intent_unexpected_state" && error.payment_intent?.status === "canceled";
}
