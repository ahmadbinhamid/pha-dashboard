export type ShippingMethod = "standard" | "calculated";
export type ShippingAddressType = "business" | "residential";
export type AuStateCode = "ACT" | "NSW" | "NT" | "QLD" | "SA" | "TAS" | "VIC" | "WA";

// Never includes the API key, only whether one is saved.
export interface ShippingSettings {
  transdirect_configured: boolean;
  sender_postcode: string | null;
  sender_suburb: string | null;
  sender_state: string | null;
  sender_type: ShippingAddressType;
}

export interface UpdateShippingSettingsPayload {
  // Blank keeps the saved key.
  api_key?: string;
  sender_postcode?: string;
  sender_suburb?: string;
  sender_state?: string;
  sender_type?: ShippingAddressType;
}
