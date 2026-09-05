import { z } from "zod";

// targetCountry is constrained to what google.adapter.js#COUNTRY_CURRENCY
// actually maps to a real currency — anything outside this list silently
// falls back to USD server-side, which is worse than just not offering it
// as an option here.
export const GOOGLE_TARGET_COUNTRIES = [
  { value: "AU", label: "Australia (AUD)" },
  { value: "US", label: "United States (USD)" },
  { value: "GB", label: "United Kingdom (GBP)" },
  { value: "NZ", label: "New Zealand (NZD)" },
  { value: "CA", label: "Canada (CAD)" },
] as const;

export const googleConnectFormSchema = z.object({
  merchantId: z.string().trim().min(1, "Merchant Center ID is required"),
  feedLabel: z.string().trim().min(1, "Feed label is required"),
  contentLanguage: z.string().trim().min(1, "Content language is required"),
  targetCountry: z.string().trim().min(1, "Target country is required"),
});

export type GoogleConnectFormValues = z.infer<typeof googleConnectFormSchema>;
