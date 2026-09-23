// Generic channel/marketplace shape from GET /channels, mirroring services/marketplace/channel.service.js#listChannelsForTenant. One entry per registered adapter, the shared type for any channel-status UI.

// "pending": OAuth consent succeeded and a token is saved, but the tenant hasn't picked a Merchant Center account yet (channel-architecture.md §9). Only the Google adapter produces this; eBay never does.
export type ChannelConnectionStatus = "connected" | "disconnected" | "degraded" | "error" | "pending";

export interface ChannelConnectionInfo {
  status: ChannelConnectionStatus;
  connected_at: string | null;
  last_error: string | null;
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

export interface ChannelSummary {
  key: string;
  name: string;
  logo: string | null;
  description: string;
  status: string;
  authType: string;
  setupSteps: string[];
  requiredTenantData: string[];
  // True unless this channel needs something the tenant doesn't have yet (Google Shopping: a verified storefront domain). `unavailable_reason` is a ready-to-show string whenever this is false.
  requiresStorefront?: boolean;
  available: boolean;
  unavailable_reason: string | null;
  capabilities: ChannelCapabilities;
  connection: ChannelConnectionInfo;
  health: ChannelHealthInfo;
  listing_counts: Record<string, number>;
  // Real per-platform "most recent listing sync" timestamp, distinct from health.last_success_at (connection-level "last successful API call").
  last_synced_at: string | null;
  // Sum of this channel's listings in sync_status error/price_locked, computed server-side (channel.service.js).
  needs_attention_count: number;
  // Folds needs_attention_count with connection-level trouble (tripped circuit breaker, failure streak) into one verdict for the summary card.
  health_status: "healthy" | "needs_attention";
}
