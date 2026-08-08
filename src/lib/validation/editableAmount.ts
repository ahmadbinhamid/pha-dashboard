import { z } from "zod";

// Blank is treated the same as "0" (matches the original inline-edit's
// `Number(value)` coercion, where `Number("") === 0`) — only NaN/negative
// are rejected.
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
