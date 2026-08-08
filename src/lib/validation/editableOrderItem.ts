import { z } from "zod";

export const editableUnitPriceFormSchema = z.object({
  amount: z.string().refine(
    (s) => {
      const n = Number(s);
      return Number.isFinite(n) && n > 0;
    },
    { message: "Enter a valid price" },
  ),
});
export type EditableUnitPriceFormValues = z.infer<typeof editableUnitPriceFormSchema>;

// Blank is treated the same as "0" (matches the original's `Number(value)`
// coercion, where `Number("") === 0`) — only NaN/negative are rejected.
export const editableDiscountFormSchema = z.object({
  amount: z.string().refine(
    (s) => {
      const n = Number(s);
      return Number.isFinite(n) && n >= 0;
    },
    { message: "Enter a valid discount" },
  ),
});
export type EditableDiscountFormValues = z.infer<typeof editableDiscountFormSchema>;
