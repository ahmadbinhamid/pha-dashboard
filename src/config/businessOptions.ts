import type { PaymentTermsDays } from "@/types/business";

// Mirrors server PAYMENT_TERMS_DAYS; no terms means due on receipt.
export const PAYMENT_TERMS_DAYS: readonly PaymentTermsDays[] = [7, 14, 30];

export const PAYMENT_TERMS_LABEL: Record<PaymentTermsDays, string> = {
  7: "7-day account",
  14: "14-day account",
  30: "30-day account",
};

export const NO_PAYMENT_TERMS_LABEL = "None (due on receipt)";

// SingleSelect values are strings, so "" stands for no terms.
export const PAYMENT_TERMS_OPTIONS = [
  { value: "", label: NO_PAYMENT_TERMS_LABEL },
  ...PAYMENT_TERMS_DAYS.map((days) => ({ value: String(days), label: PAYMENT_TERMS_LABEL[days] })),
];
