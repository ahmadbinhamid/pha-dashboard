import { z } from "zod";

// Every text field here is a plain (never-null) string in FORM state — the
// backend's BankDetails/PickupLocation types allow null, but null flowing
// into a controlled <input value=...> causes React's "switching between
// controlled/uncontrolled" warning (and a value glitch) the moment the user
// types the first character. toFormState() below normalizes null -> "" on
// the way in, same as the original code did inline at each `?? ""`.
const bankDetailsSchema = z.object({
  bank_name: z.string(),
  account_name: z.string(),
  bsb: z.string(),
  account_number: z.string(),
});

const pickupLocationSchema = z.object({
  name: z.string(),
  address: z.string(),
  country: z.string(),
  trading_hours: z.array(z.string()),
});

export const companyProfileFormSchema = z.object({
  company_name: z.string(),
  abn: z.string(),
  phone: z.string(),
  email: z.string(),
  bank_details: bankDetailsSchema,
  pickup_location: pickupLocationSchema,
  warranty_text: z.string(),
  legal_disclaimer_text: z.string(),
  logo_url: z.string().nullable(),
  favicon_url: z.string().nullable(),
  brand_colour: z.string(),
  accent_colour: z.string(),
  order_number_prefix: z.string(),
  invoice_number_prefix: z.string(),
});

export type CompanyProfileFormValues = z.infer<typeof companyProfileFormSchema>;
