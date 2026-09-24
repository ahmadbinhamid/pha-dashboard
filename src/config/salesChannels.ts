// Product edit page tabs; `channels` hosts Sales Channels.
export const PRODUCT_EDIT_TABS = ["details", "channels", "notes"] as const;
export type ProductEditTab = (typeof PRODUCT_EDIT_TABS)[number];

// Legacy anchor from earlier links; still opens the channels tab.
export const SALES_CHANNELS_ANCHOR = "sales-channels";

/** Product edit URL on the Sales Channels tab, optionally one channel. */
export function productChannelsPath(slug: string, channel?: string | null) {
  return `/products/${slug}/edit?tab=channels${channel ? `&channel=${encodeURIComponent(channel)}` : ""}`;
}
