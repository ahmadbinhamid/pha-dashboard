import { z } from "zod";

// Step 2 of Meta's connect: both ids come from the pickers, never typed.
export const metaCompleteConnectFormSchema = z.object({
  businessId: z.string().trim().min(1, "Choose a business"),
  catalogId: z.string().trim().min(1, "Choose a catalog"),
});

export type MetaCompleteConnectFormValues = z.infer<typeof metaCompleteConnectFormSchema>;
