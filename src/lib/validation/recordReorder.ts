import { z } from "zod";

// Kept as a string end-to-end (not z.coerce.number()) so the inferred type
// matches the controlled <input>'s actual value type — RHF's resolver
// validates the string's numeric-ness without changing what `register`/
// `watch` deal with.
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
