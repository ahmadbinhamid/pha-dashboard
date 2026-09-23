import { z } from "zod";

// Deliberately permissive (mirrors smtpSettings.ts) — the original form had no validation beyond "threshold parses to a number".
export const inventorySettingsFormSchema = z.object({
  threshold: z.string(),
  emailEnabled: z.boolean(),
  email: z.string(),
  sendTime: z.string(),
});

export type InventorySettingsFormValues = z.infer<typeof inventorySettingsFormSchema>;
