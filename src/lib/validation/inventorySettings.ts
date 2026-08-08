import { z } from "zod";

// Deliberately permissive (mirrors smtpSettings.ts) — the original form had
// no validation beyond "threshold parses to a number", so this doesn't add
// new required-ness that could reject previously-accepted input.
export const inventorySettingsFormSchema = z.object({
  threshold: z.string(),
  emailEnabled: z.boolean(),
  email: z.string(),
  sendTime: z.string(),
});

export type InventorySettingsFormValues = z.infer<typeof inventorySettingsFormSchema>;
