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

// Shared by every "tenant supplies their own credentials" integration
// (Stripe keys, SMTP) — mirrors CONNECTION_STATUS in tenant.constants.js.
export type ConnectionStatus = "not_connected" | "connected" | "error";

// Mirrors PAYMENT_DOMAIN_MODE in tenant.constants.js.
export type PaymentDomainMode = "default" | "vendor_slug";

export interface PaymentLinkPreview {
  default: string;
  vendor_slug: string;
}

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
  payment_domain_mode: PaymentDomainMode;
  // Sample URLs for both modes, built server-side from PAYMENT_LINK_DOMAIN —
  // not itself saved, just returned alongside settings for the picker's preview.
  payment_link_preview: PaymentLinkPreview;
  // BYOK — the secret key itself is never returned to the client (select:
  // false on the backend); only what's safe/useful to show in Settings.
  stripe_publishable_key: string | null;
  stripe_connection_status: ConnectionStatus;
  stripe_connected_at: string | null;
  stripe_last_error: string | null;
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
    | "payment_domain_mode"
  >
>;

export interface StripeKeysStatus {
  connected: boolean;
  connection_status: ConnectionStatus;
  publishable_key: string | null;
  webhook_token: string | null;
  webhook_url: string | null;
  webhook_configured: boolean;
  last_error: string | null;
}

// secret_key omitted entirely = "leave unchanged"; "" clears a saved key.
export interface UpdateStripeKeysPayload {
  secret_key?: string;
  publishable_key?: string;
}

export interface SmtpStatus {
  connected: boolean;
  connection_status: ConnectionStatus;
  host: string | null;
  port: number | null;
  user: string | null;
  from_name: string | null;
  from_email: string | null;
  last_error: string | null;
}

// pass omitted entirely = "leave unchanged"; "" clears saved credentials.
export interface UpdateSmtpCredentialsPayload {
  host?: string;
  port?: number | null;
  user?: string;
  pass?: string;
  from_name?: string;
  from_email?: string;
}
