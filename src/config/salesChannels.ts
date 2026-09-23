// Where listing management lives now: the product form's Sales Channels section.
export const SALES_CHANNELS_ANCHOR = "sales-channels";

/** Product edit URL focused on Sales Channels, optionally opening one channel's panel. */
export function productChannelsPath(slug: string, channel?: string | null) {
  return `/products/${slug}/edit${channel ? `?channel=${encodeURIComponent(channel)}` : ""}#${SALES_CHANNELS_ANCHOR}`;
}
