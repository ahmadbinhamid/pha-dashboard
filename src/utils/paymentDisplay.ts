import { PAYMENT_METHOD_LABEL } from "@/config/paymentMethods";
import type { Payment, PaymentMethod } from "@/types/payment";

type PaymentSourceFields = Pick<Payment, "provider" | "payment_method" | "card_brand" | "card_last4">;

// Row label for "how was this collected" — shared by PaymentDetailDrawer and
// PaymentHistoryList so the three provider cases (Stripe/manual/eBay) can't
// drift between the two places that render it.
export function getPaymentSourceLabel(payment: Pick<Payment, "provider">): string {
  if (payment.provider === "manual") return "Payment Method";
  if (payment.provider === "ebay") return "Payment Source";
  return "Card";
}

// The value shown next to that label.
export function getPaymentMethodDisplay(payment: PaymentSourceFields): string {
  if (payment.provider === "manual") {
    return payment.payment_method ? PAYMENT_METHOD_LABEL[payment.payment_method as PaymentMethod] : "Manual";
  }
  // eBay collects payment on their end (Managed Payments) — there's no card
  // or staff-picked method to show, just the fact that eBay handled it.
  if (payment.provider === "ebay") return "eBay Managed Payments";
  return payment.card_brand
    ? `${payment.card_brand.charAt(0).toUpperCase()}${payment.card_brand.slice(1)} •••• ${payment.card_last4}`
    : "Card";
}
