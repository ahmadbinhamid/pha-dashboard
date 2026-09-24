import type { ChannelStatusReason } from "@/types/channel";

// Where the tenant fixes each unmet channel prerequisite.
export const CHANNEL_STATUS_REASON_ACTION: Record<ChannelStatusReason, { label: string; href: string }> = {
  storefront_required: { label: "Verify domain in Settings › Domains", href: "/settings/integrations/domains" },
};
