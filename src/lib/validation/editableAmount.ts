import { z } from "zod";

// Blank treated as "0" (matches the original `Number(value)` coercion) — only NaN/negative rejected.
export const editableAmountFormSchema = z.object({
  amount: z.string().refine(
    (s) => {
      const n = Number(s);
      return Number.isFinite(n) && n >= 0;
    },
    { message: "Enter a valid amount" },
  ),
});

export type EditableAmountFormValues = z.infer<typeof editableAmountFormSchema>;
