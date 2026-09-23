import { z } from "zod";

// targetCountry constrained to what google.adapter.js#COUNTRY_CURRENCY maps to a real currency — anything else silently falls back to USD server-side.
export const GOOGLE_TARGET_COUNTRIES = [
  { value: "AU", label: "Australia (AUD)" },
  { value: "US", label: "United States (USD)" },
  { value: "GB", label: "United Kingdom (GBP)" },
  { value: "NZ", label: "New Zealand (NZD)" },
  { value: "CA", label: "Canada (CAD)" },
] as const;

// Step 2 of the connect flow (after OAuth consent): merchantId is either chosen from the dropdown or typed manually when accounts.list wasn't usable. feedLabel/contentLanguage are optional, defaulted server-side.
export const googleCompleteConnectFormSchema = z.object({
  merchantId: z.string().trim().min(1, "Choose (or enter) a Merchant Center account"),
  targetCountry: z.string().trim().min(1, "Target country is required"),
  feedLabel: z.string().trim().optional(),
  contentLanguage: z.string().trim().optional(),
});

export type GoogleCompleteConnectFormValues = z.infer<typeof googleCompleteConnectFormSchema>;
