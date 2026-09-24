// GET /channels shape (channel.service.js#listChannelsForTenant), per adapter.

// "pending" (Google only): OAuth done but no Merchant Center account picked.
export type ChannelConnectionStatus = "connected" | "disconnected" | "degraded" | "error" | "pending";

// Unmet manifest prerequisite behind a status of "error".
export type ChannelStatusReason = "storefront_required";

export interface ChannelConnectionInfo {
  status: ChannelConnectionStatus;
  connected_at: string | null;
  last_error: string | null;
  status_reason: ChannelStatusReason | null;
  // Tenant-facing explanation with the remedy, set with status_reason.
  status_message: string | null;
}

export interface ChannelHealthInfo {
  consecutive_failures: number;
  last_success_at: string | null;
}

export interface ChannelCapabilities {
  publish: boolean;
  inventory: boolean;
  batch: boolean;
  orders: boolean;
  webhooks: boolean;
  inboundInventory: boolean;
  variants: boolean;
}

// A channel-only form field from manifest.fieldSchema, with static options.
export type ChannelFieldType = "text" | "textarea" | "number" | "boolean" | "select" | "category" | "policy" | "custom";

export interface ChannelFieldOption {
  value: string;
  label: string;
}

export interface ChannelFieldDescriptor {
  key: string;
  label: string;
  type: ChannelFieldType;
  required: boolean;
  helpText?: string;
  optionsSource?: string;
  group?: string;
  options?: ChannelFieldOption[];
  // Product field an empty listing value falls back to (shown "from product").
  inheritsFrom?: string;
}

export interface ChannelProductConstraints {
  title?: { maxLength: number };
}

export interface ChannelSummary {
  key: string;
  name: string;
  logo: string | null;
  description: string;
  status: string;
  authType: string;
  setupSteps: string[];
  requiredTenantData: string[];
  // Channel-only fields for the product form's panel.
  fieldSchema?: ChannelFieldDescriptor[];
  productConstraints?: ChannelProductConstraints;
  // False if a prerequisite is missing (e.g. domain); see unavailable_reason.
  requiresStorefront?: boolean;
  available: boolean;
  unavailable_reason: string | null;
  capabilities: ChannelCapabilities;
  connection: ChannelConnectionInfo;
  health: ChannelHealthInfo;
  listing_counts: Record<string, number>;
  // Latest listing sync; health.last_success_at is the last API success.
  last_synced_at: string | null;
  // Listings in error/price_locked, counted server-side.
  needs_attention_count: number;
  // needs_attention_count plus connection trouble, as one card verdict.
  health_status: "healthy" | "needs_attention";
}

export type ChannelSyncLogStatus = "success" | "failure" | "skipped";

// One ChannelSyncLog row (GET /channels/:platform/logs).
export interface ChannelSyncLog {
  _id: string;
  platform: string;
  job_type: string;
  entity_type: string | null;
  entity_id: string | null;
  status: ChannelSyncLogStatus;
  attempt: number;
  error_code: string | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}
