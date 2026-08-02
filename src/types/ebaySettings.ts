export type EbayConnectionStatus = "not_connected" | "connected" | "token_expired" | "revoked" | "error";

export interface EbaySettings {
  marketplace_id: string;
  sandbox: boolean;
  merchant_location_key: string | null;
  fulfillment_policy_id: string | null;
  payment_policy_id: string | null;
  return_policy_id: string | null;
  warehouse_street: string | null;
  warehouse_city: string | null;
  warehouse_state: string | null;
  warehouse_postcode: string | null;
  warehouse_country: string | null;
  warehouse_phone: string | null;
  fallback_image_url: string | null;
  connection_status: EbayConnectionStatus;
  connected_at: string | null;
  last_error: string | null;
}

// refresh_token is intentionally excluded — it's only ever set via the OAuth
// consent flow, never sent from the frontend directly.
export type UpdateEbaySettingsPayload = Partial<
  Omit<EbaySettings, "connection_status" | "connected_at" | "last_error">
>;

export interface EbayStatus {
  connected: boolean;
  reason?: string;
}

export interface EbayConnectUrlResponse {
  url: string;
}
