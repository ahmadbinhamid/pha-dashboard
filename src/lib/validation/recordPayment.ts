import { z } from "zod";
import { formatCurrencyFromCents } from "@/utils/format";

// Dollars-as-string, bounded by the order's current balance due — factory
// since the max is per-order, not a fixed rule.
export function recordPaymentFormSchema(balanceDueCents: number) {
  const balanceDueDollars = balanceDueCents / 100;
  return z.object({
    payment_method: z.enum(["cash", "online_transfer", "efpos"]),
    amount: z.string().superRefine((s, ctx) => {
      const n = Number(s);
      if (!n || n <= 0) {
        ctx.addIssue({ code: "custom", message: "Enter an amount greater than $0" });
        return;
      }
      if (n > balanceDueDollars) {
        ctx.addIssue({
          code: "custom",
          message: `Amount can't exceed the balance due (${formatCurrencyFromCents(balanceDueCents)})`,
        });
      }
    }),
  });
}

export type RecordPaymentFormValues = z.infer<ReturnType<typeof recordPaymentFormSchema>>;
