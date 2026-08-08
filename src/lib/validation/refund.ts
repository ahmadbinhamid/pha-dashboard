import { z } from "zod";

// Mirrors the same string-based numeric pattern as commonFields.ts's
// priceSchema — kept separate since the max bound is refund-specific
// (cents, dynamic per order) rather than a flat "> 0" check.
export function refundAmountSchema(maxRefundableCents: number) {
  return z.string().superRefine((s, ctx) => {
    const n = Number(s);
    if (s.trim() === "" || !Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
      return;
    }
    const cents = Math.round(n * 100);
    if (!Number.isInteger(cents) || cents < 1) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
      return;
    }
    if (cents > maxRefundableCents) {
      ctx.addIssue({ code: "custom", message: "Amount exceeds what's refundable" });
    }
  });
}
