import { z } from "zod";

// Permissive by design; the API validates ranges.
export const inventorySettingsFormSchema = z.object({
  threshold: z.string(),
  emailEnabled: z.boolean(),
  email: z.string(),
  sendTime: z.string(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  weekday: z.string(),
  monthDay: z.string(),
});

export type InventorySettingsFormValues = z.infer<typeof inventorySettingsFormSchema>;
