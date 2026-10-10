// Product edit page tabs; `channels` hosts Sales Channels.
export const PRODUCT_EDIT_TABS = ["details", "channels", "notes"] as const;
export type ProductEditTab = (typeof PRODUCT_EDIT_TABS)[number];

// Legacy anchor from earlier links; still opens the channels tab.
export const SALES_CHANNELS_ANCHOR = "sales-channels";

/** Product edit URL on the Sales Channels tab, optionally one channel. */
export function productChannelsPath(slug: string, channel?: string | null) {
  return `/products/${slug}/edit?tab=channels${channel ? `&channel=${encodeURIComponent(channel)}` : ""}`;
}

import type { MappedCategory } from "@/types/categoryMapping";

// Where a listing's channel category comes from (row badge and drawer).
export const CATEGORY_SOURCE_LABEL = {
  override: (channelName: string) => `Overridden for ${channelName}`,
  mapping: "From category mapping",
} as const;

// Per-channel wording; Meta's own mapping is an override of Google's.
const CHANNEL_CATEGORY_SOURCE_LABEL: Record<string, { listing: string; mapping: string; fallback: string }> = {
  meta: { listing: "Set on this product", mapping: "Meta override", fallback: "From Google mapping" },
};

/** Badge text for a category set on the listing, or taken from a mapping. */
export function categorySourceLabel(channelKey: string, channelName: string, mapped: MappedCategory | null | undefined, onListing: boolean) {
  const custom = CHANNEL_CATEGORY_SOURCE_LABEL[channelKey];
  if (onListing) return custom?.listing ?? CATEGORY_SOURCE_LABEL.override(channelName);
  if (mapped?.source === "fallback_mapping") return custom?.fallback ?? CATEGORY_SOURCE_LABEL.mapping;
  return custom?.mapping ?? CATEGORY_SOURCE_LABEL.mapping;
}
