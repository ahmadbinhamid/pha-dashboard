import { z } from "zod";

export const ebaySettingsFormSchema = z.object({
  marketplace_id: z.string(),
  merchant_location_key: z.string(),
  fulfillment_policy_id: z.string(),
  payment_policy_id: z.string(),
  return_policy_id: z.string(),
  warehouse_street: z.string(),
  warehouse_city: z.string(),
  warehouse_state: z.string(),
  warehouse_postcode: z.string(),
  warehouse_country: z.string(),
  warehouse_phone: z.string(),
  fallback_image_url: z.string(),
});

export type EbaySettingsFormValues = z.infer<typeof ebaySettingsFormSchema>;
