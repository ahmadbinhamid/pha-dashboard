import { z } from "zod";
import { FOLLOW_UP_DAYS } from "@/config/followups";
import type { EmailDesign } from "@/types/campaign";

const days = z
  .number({ message: "Enter a number of days" })
  .int()
  .min(FOLLOW_UP_DAYS.min, `At least ${FOLLOW_UP_DAYS.min} day`)
  .max(FOLLOW_UP_DAYS.max, `At most ${FOLLOW_UP_DAYS.max} days`);

export const followUpFormSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(120),
  shipped_delay_days: days,
  handover_delay_days: days,
  channels: z.array(z.enum(["storefront", "manual"])).min(1, "Pick at least one"),
  subject: z.string().trim().min(1, "Add a subject line").max(200),
  preheader: z.string().trim().max(200),
  design: z.custom<EmailDesign>(),
  ask_for_rating: z.boolean(),
  alert_at_or_below: z.string(),
  alert_email: z.string().trim().refine((v) => !v || /^\S+@\S+\.\S+$/.test(v), "Enter a valid email"),
});

export type FollowUpFormValues = z.infer<typeof followUpFormSchema>;
