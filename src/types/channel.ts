// Generic channel/marketplace shape returned by GET /channels — mirrors
// services/marketplace/channel.service.js#listChannelsForTenant on the
// backend. One entry per registered adapter (eBay, Google Shopping, ...),
// so this stays the shared type for any channel-status UI rather than a
// per-platform duplicate.

export type ChannelConnectionStatus = "connected" | "disconnected" | "degraded" | "error";

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
  capabilities: ChannelCapabilities;
  connection: ChannelConnectionInfo;
  health: ChannelHealthInfo;
  listing_counts: Record<string, number>;
}
