import { z } from "zod";

// Step 2 of Meta's connect: the catalog comes from the picker, never typed.
export const metaCompleteConnectFormSchema = z.object({
  catalogId: z.string().trim().min(1, "Choose a catalog"),
});

export type MetaCompleteConnectFormValues = z.infer<typeof metaCompleteConnectFormSchema>;
