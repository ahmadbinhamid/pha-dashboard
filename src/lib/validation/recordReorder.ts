import { z } from "zod";

// Kept as a string (not z.coerce.number()) so the inferred type matches the controlled <input>'s value type.
export const recordReorderFormSchema = z.object({
  quantity: z.string().refine(
    (s) => {
      const n = Number(s);
      return Number.isFinite(n) && Number.isInteger(n) && n > 0;
    },
    { message: "Enter a quantity greater than 0" },
  ),
});

export type RecordReorderFormValues = z.infer<typeof recordReorderFormSchema>;
