/**
 * Server-side eBay configuration. Do not import this module from client components.
 */

/**
 * eBay Sell / Identity environment (server-side only in practice).
 *
 * OAuth:
 * - EBAY_CLIENT_ID
 * - EBAY_CLIENT_SECRET
 * - EBAY_REDIRECT_URI — must match the RuName callback URL (e.g. https://yourhost/api/tools/ebay/oauth/callback)
 * - EBAY_USE_SANDBOX — "1" or "true" for sandbox APIs + auth host
 *
 * Listing defaults:
 * - EBAY_MARKETPLACE_ID — default EBAY_AU
 * - EBAY_DEFAULT_CATEGORY_ID — required for live publish unless set on the form
 * - EBAY_PUBLISH_DRY_RUN — default on; set "false" for live Inventory API calls
 */
export function ebayUseSandbox(): boolean {
  return process.env.EBAY_USE_SANDBOX === "1" || process.env.EBAY_USE_SANDBOX === "true";
}

export function ebayApiBase(): string {
  return ebayUseSandbox() ? "https://api.sandbox.ebay.com" : "https://api.ebay.com";
}

export function ebayAuthBase(): string {
  return ebayUseSandbox() ? "https://auth.sandbox.ebay.com" : "https://auth.ebay.com";
}

export function ebayClientId(): string | undefined {
  return process.env.EBAY_CLIENT_ID?.trim() || undefined;
}

export function ebayClientSecret(): string | undefined {
  return process.env.EBAY_CLIENT_SECRET?.trim() || undefined;
}

export function ebayRedirectUri(): string | undefined {
  return process.env.EBAY_REDIRECT_URI?.trim() || undefined;
}

export function ebayMarketplaceId(): string {
  return process.env.EBAY_MARKETPLACE_ID?.trim() || "EBAY_AU";
}

export function ebayDefaultCategoryId(): string | undefined {
  return process.env.EBAY_DEFAULT_CATEGORY_ID?.trim() || undefined;
}

export function ebayPublishDryRun(): boolean {
  const v = process.env.EBAY_PUBLISH_DRY_RUN?.trim().toLowerCase();
  if (v === "0" || v === "false") return false;
  return true;
}

export function isEbayOAuthConfigured(): boolean {
  return Boolean(ebayClientId() && ebayClientSecret() && ebayRedirectUri());
}

export function isEbayLivePublishConfigured(): boolean {
  return (
    isEbayOAuthConfigured() &&
    !ebayPublishDryRun() &&
    Boolean(ebayDefaultCategoryId())
  );
}
