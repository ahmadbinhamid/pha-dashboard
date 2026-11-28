import { z } from "zod";
import type { EmailDesign } from "@/types/campaign";

export const campaignFormSchema = z
  .object({
    name: z.string().trim().min(1, "Give the campaign a name").max(120),
    kind: z.enum(["one_time", "recurring"]),
    subject: z.string().trim().max(200),
    preheader: z.string().trim().max(200),
    design: z.custom<EmailDesign>(),
    audience_type: z.enum(["all", "lists", "contacts"]),
    audience_lists: z.array(z.string()),
    audience_contact_ids: z.array(z.string()),
    frequency: z.enum(["weekly", "fortnightly", "monthly"]),
    day_of_week: z.string(),
    day_of_month: z.string(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Pick a time"),
    timezone: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.audience_type === "lists" && !v.audience_lists.length) {
      ctx.addIssue({ code: "custom", path: ["audience_lists"], message: "Pick at least one list" });
    }
    if (v.audience_type === "contacts" && !v.audience_contact_ids.length) {
      ctx.addIssue({ code: "custom", path: ["audience_contact_ids"], message: "Pick at least one contact" });
    }
  });

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;

export const contactFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  first_name: z.string().trim().max(80),
  last_name: z.string().trim().max(80),
  lists: z.array(z.string()),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
