import type { ChannelRef, ChannelStatusAction, ChannelStatusReason } from "@/types/channel";

// Where the tenant fixes each status_reason; reconnect is per channel.
export const CHANNEL_STATUS_REASON_ACTION: Record<ChannelStatusReason, (channel: ChannelRef) => ChannelStatusAction> = {
  storefront_required: () => ({ label: "Verify domain in Settings › Domains", href: "/settings/integrations/domains" }),
  reauthentication_required: (channel) => ({
    label: `Reconnect ${channel.name}`,
    href: `/settings/integrations/${channel.key}`,
  }),
};
