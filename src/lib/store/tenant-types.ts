/** White-label / multi-tenant branding (future: subdomain + DB). */
export type StoreTheme = {
  /** HSL components only, e.g. "216 100% 58%" */
  primary: string;
  primaryForeground: string;
};

export type StoreTenant = {
  id: string;
  slug: string;
  /** Display name — never hardcode in UI; use this. */
  companyName: string;
  tagline: string;
  logoUrl: string | null;
  theme: StoreTheme;
  supportEmail: string;
  supportPhone: string;
  /** ISO currency code for storefront */
  currency: "AUD";
  /** Default warehouse label for B2C copy */
  defaultWarehouse: string;
};
