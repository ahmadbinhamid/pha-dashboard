import { z } from "zod";

export const shippingSettingsFormSchema = z.object({
  api_key: z.string(),
  sender_postcode: z.string().trim().refine((v) => v === "" || /^\d{4}$/.test(v), "Postcode must be 4 digits"),
  sender_suburb: z.string().trim().max(80),
  sender_state: z.string().trim().max(10),
  sender_type: z.enum(["business", "residential"]),
});

export type ShippingSettingsFormValues = z.infer<typeof shippingSettingsFormSchema>;
