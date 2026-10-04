import type { ChannelConnectionStatus } from "@/types/channel";
import type { ChannelStatusDisplay } from "@/types/channelConnect";

// Connect-card badge per connection status; platforms may override entries.
export const CHANNEL_STATUS_DISPLAY: Record<ChannelConnectionStatus, ChannelStatusDisplay> = {
  connected: { variant: "ok", label: "Connected" },
  degraded: { variant: "warn", label: "Sync paused — repeated errors" },
  error: { variant: "danger", label: "Connection error" },
  disconnected: { variant: "muted", label: "Not connected" },
  pending: { variant: "warn", label: "Choose a Merchant Center account to finish connecting" },
};

export const CHANNEL_NEEDS_ATTENTION_LABEL = "Needs attention";
export const CHANNEL_UNAVAILABLE_LABEL = "Unavailable";
