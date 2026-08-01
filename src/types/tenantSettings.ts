export interface BankDetails {
  bank_name: string | null;
  account_name: string | null;
  bsb: string | null;
  account_number: string | null;
}

export interface PickupLocation {
  name: string | null;
  address: string | null;
  country: string | null;
  trading_hours: string[];
}

export type StripeOnboardingStatus = "not_started" | "in_progress" | "complete";

export interface TenantSettings {
  _id: string;
  name: string;
  slug: string;
  code: string;
  status: "active" | "suspended";
  company_name: string | null;
  abn: string | null;
  phone: string | null;
  email: string | null;
  bank_details: BankDetails;
  pickup_location: PickupLocation;
  warranty_text: string | null;
  legal_disclaimer_text: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  brand_colour: string;
  accent_colour: string;
  stripe_account_id: string | null;
  stripe_onboarding_status: StripeOnboardingStatus;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type UpdateTenantSettingsPayload = Partial<
  Pick<
    TenantSettings,
    | "company_name"
    | "abn"
    | "phone"
    | "email"
    | "bank_details"
    | "pickup_location"
    | "warranty_text"
    | "legal_disclaimer_text"
    | "logo_url"
    | "favicon_url"
    | "brand_colour"
    | "accent_colour"
  >
>;

export interface StripeConnectStatus {
  connected: boolean;
  onboarding_status: StripeOnboardingStatus;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  requirements_due?: string[];
}
