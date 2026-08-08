import { z } from "zod";

// Kept as a string (not z.coerce.number()) so RHF's controlled <input>
// value type matches the schema's input type exactly.
export const setStockFormSchema = z.object({
  stock_count: z.string().refine(
    (s) => {
      const n = parseInt(s, 10);
      return !Number.isNaN(n) && n >= 0;
    },
    { message: "Enter a valid stock count" },
  ),
  reason: z.string(),
});

export type SetStockFormValues = z.infer<typeof setStockFormSchema>;
