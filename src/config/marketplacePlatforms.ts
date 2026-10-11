export const PLATFORM_LABEL: Record<string, string> = {
  ebay: "eBay",
  google: "Google Shopping",
  meta: "Meta",
  amazon: "Amazon",
  shopify: "Shopify",
};

// Platforms wired end-to-end; amazon/shopify have labels but no listing flow.
export const AVAILABLE_PLATFORMS = ["ebay", "google", "meta"];
