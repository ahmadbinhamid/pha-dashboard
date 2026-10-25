import type { OrderChannel } from "@/types/orders";

export const ORDER_CHANNEL_LABEL: Record<OrderChannel, string> = {
  storefront: "Storefront",
  ebay: "eBay",
  manual: "In-Store",
};

// Same --cat slots the revenue charts give each channel, so colours match.
export const ORDER_CHANNEL_STYLE: Record<OrderChannel, { badge: string; accent: string }> = {
  storefront: { badge: "bg-cat-1/12 text-cat-1 ring-1 ring-inset ring-cat-1/30", accent: "border-l-cat-1" },
  ebay: { badge: "bg-cat-2/12 text-cat-2 ring-1 ring-inset ring-cat-2/30", accent: "border-l-cat-2" },
  manual: { badge: "bg-cat-3/12 text-cat-3 ring-1 ring-inset ring-cat-3/30", accent: "border-l-cat-3" },
};
