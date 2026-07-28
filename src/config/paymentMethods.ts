import type { OrderPaymentChoice, PaymentMethod } from "@/types/payment";

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: "Cash",
  online_transfer: "Online Transfer",
  efpos: "EFPOS",
};

export const ORDER_PAYMENT_CHOICE_LABEL: Record<OrderPaymentChoice, string> = {
  ...PAYMENT_METHOD_LABEL,
  payment_link: "Payment Link (Stripe)",
};
