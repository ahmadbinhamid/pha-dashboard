import { z } from "zod";

export const smtpSettingsFormSchema = z.object({
  host: z.string(),
  port: z.string(),
  user: z.string(),
  pass: z.string(),
  from_name: z.string(),
  from_email: z.string(),
});

export type SmtpSettingsFormValues = z.infer<typeof smtpSettingsFormSchema>;
