import { z } from "zod";

export const stripeKeysFormSchema = z.object({
  secret_key: z.string(),
  publishable_key: z.string(),
});

export type StripeKeysFormValues = z.infer<typeof stripeKeysFormSchema>;

export const webhookSecretFormSchema = z.object({
  webhook_secret: z.string().trim().min(1, "Enter the signing secret"),
});

export type WebhookSecretFormValues = z.infer<typeof webhookSecretFormSchema>;
