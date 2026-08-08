import { z } from "zod";

// Factory since "resulting stock can't go negative" depends on the item's
// current stock count, not a fixed rule.
export function adjustStockFormSchema(currentStock: number) {
  return z.object({
    adjustment: z.number().int().refine((n) => n !== 0, { message: "Enter a non-zero adjustment" }),
    type: z.string(),
    note: z.string(),
  }).superRefine((values, ctx) => {
    if (currentStock + values.adjustment < 0) {
      ctx.addIssue({ code: "custom", message: "Resulting stock cannot be negative.", path: ["adjustment"] });
    }
  });
}

export type AdjustStockFormValues = z.infer<ReturnType<typeof adjustStockFormSchema>>;
