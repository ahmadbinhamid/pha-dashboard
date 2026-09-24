// services/marketplace/listing.resolver.js
// Merges Product/Variant content with listing overrides; adapters read this.

const { httpError } = require("../../utils/http/httpError");
const { CHANNEL_PREREQUISITE_ERROR_CODE, CHANNEL_STATUS_REASON } = require("../../constants/channel.constants");

function resolveSku(listing, product, variant) {
  // eBay discriminator exposes store_sku; fall through for other platforms
  if (listing.store_sku) return listing.store_sku;
  if (variant) return variant.sku || `ph-${product._id}-${variant._id}`;
  return product.sku || `ph-${product._id}`;
}

function resolvePhotos(listing, product, variant) {
  if (listing.photo_overrides && listing.photo_overrides.length > 0) {
    return listing.photo_overrides;
  }
  // Variant photos take precedence over product photos when no override is set
  if (variant && variant.attachments && variant.attachments.length > 0) {
    return variant.attachments;
  }
  return product.attachments || [];
}

function resolvePrice(listing, product, variant) {
  if (listing.price_override != null) return listing.price_override;
  if (variant) return variant.price ?? product.price ?? 0;
  return product.price ?? 0;
}

// Listing's own channel category, or null (hydration may apply the mapping).
function resolveListingCategory(listing) {
  const registry = require("./registry");
  if (!listing.platform || !registry.has(listing.platform)) return null;
  const field = registry.get(listing.platform).categoryField;
  const id = field ? listing[field] : null;
  return id ? { id: String(id), name: null, source: "listing" } : null;
}

/** Resolved object adapters build their publish payloads from. */
function resolveListing(listing, product, variant = null) {
  const brand = listing.item_specifics?.brand || product.brand || null;

  return {
    sku: resolveSku(listing, product, variant),
    title: listing.title_override || product.title,
    description: listing.description_override || product.description || product.title,
    price: resolvePrice(listing, product, variant),
    brand,
    photos: resolvePhotos(listing, product, variant),
    identifiers: resolveIdentifiers(listing, product),
    // { id, name, source: "listing" | "mapping" } | null
    category: resolveListingCategory(listing),
    // Raw documents passed through for platform-specific fields
    listing: listing.toObject ? listing.toObject() : listing,
    product,
    variant,
  };
}

// Registry manifest lookup; null for an unknown platform means no requirement.
function getPlatformManifest(platform) {
  const registry = require("./registry");
  if (!platform || !registry.has(platform)) return null;
  return registry.get(platform).manifest;
}

const { getTotalStockForProductVariants, stockKey } = require("../inventory.service");

// Public storefront URL for feed `link` fields; platform gates the fallback.
async function resolveProductUrl(tenantId, productSlug, sku, platform) {
  assertProductSlug(productSlug, sku);
  if (!platform) {
    throw new Error("resolveProductUrl: platform is required (needed to check requiresStorefront before allowing the linkDomain fallback)");
  }
  return buildProductUrl(await resolveStorefrontHost(tenantId, platform), productSlug);
}

function assertProductSlug(productSlug, sku) {
  if (!productSlug) {
    throw httpError(`Product (SKU ${sku ?? "unknown"}) has no slug — cannot build a public product URL`, 400);
  }
}

function buildProductUrl(host, productSlug) {
  return `https://${host}/product/${productSlug}`;
}

// Host half of resolveProductUrl; per tenant, so batches resolve it once.
async function resolveStorefrontHost(tenantId, platform) {
  const Domain = require("../../models/Domain");
  const Tenant = require("../../models/Tenant");
  const config = require("../../config");
  const { DOMAIN_STATUS } = require("../../constants/domain.constants");

  const domain = await Domain.findOne({ tenant_id: tenantId, is_default: true, status: DOMAIN_STATUS.ACTIVE })
    .select("hostname")
    .lean();

  const manifest = getPlatformManifest(platform);
  const platformName = manifest?.name || platform;

  let host;
  // Default domain, else slug subdomain (never for requiresStorefront)
  if (domain) {
    host = domain.hostname;
  } else if (manifest?.requiresStorefront) {
    // NOTE: 422 (config, not transport); the code lets sync flag the connection.
    throw httpError(
      `No verified default domain for tenant ${tenantId} — ${platformName} requires a real, claimed-and-verified ` +
        `storefront domain and cannot fall back to a shared ${config.payment.linkDomain || "PAYMENT_LINK_DOMAIN"} ` +
        `subdomain (that's this platform's own domain, not one the tenant can verify ownership of with ${platformName}). ` +
        `Connect and verify a domain under Settings > Domains before connecting ${platformName}.`,
      422,
      { code: CHANNEL_PREREQUISITE_ERROR_CODE, statusReason: CHANNEL_STATUS_REASON.STOREFRONT_REQUIRED },
    );
  } else if (config.payment.linkDomain) {
    const tenant = await Tenant.findById(tenantId).select("slug").lean();
    if (!tenant?.slug) {
      throw httpError(`Tenant ${tenantId} could not be resolved (or has no slug) — cannot build a fallback storefront URL`, 422);
    }
    // Hyphens stripped, matching buildPaymentBaseUrl's per-tenant host
    host = `${tenant.slug.replace(/-/g, "")}.${config.payment.linkDomain}`;
  } else {
    throw httpError(
      `No verified default domain and no PAYMENT_LINK_DOMAIN fallback configured for tenant ${tenantId} — ` +
        `cannot build a public product URL (required for ${platformName}'s "link" field). Set a default ` +
        `verified domain under Settings > Domains, or configure PAYMENT_LINK_DOMAIN.`,
      422,
    );
  }

  return host;
}

// Raw gtin/mpn/brand as stored; channel field mapping is the adapter's job.
function resolveIdentifiers(listing, product) {
  // No product-level fallback: Product has no gtin field
  const gtin = listing.gtin || null;
  // eBay's item_specifics.mpn reused so it needn't be re-entered for Google
  const mpn = listing.mpn || listing.item_specifics?.mpn || product.mpn || null;
  const brand = listing.item_specifics?.brand || product.brand || null;
  return { gtin, mpn, brand };
}

// Tenant branding for adapters that render it (eBay description).
async function resolveBranding(tenantId) {
  const { getCompanyProfile } = require("../tenantSettings.service");
  const { company_name, logo_url } = await getCompanyProfile(tenantId);
  return { company_name, logo_url };
}

// Adds the data declared in adapter.needs, in place; items share one tenant.
async function hydrateResolved(resolvedList, adapter, tenantId) {
  const needs = adapter?.needs || {};
  if (!resolvedList.length) return resolvedList;
  if (needs.branding) {
    const branding = await resolveBranding(tenantId);
    for (const resolved of resolvedList) resolved.branding = branding;
  }
  if (adapter?.categoryField) await applyMappedCategories(resolvedList, adapter.key, tenantId);
  if (needs.stock) await applyStock(resolvedList);
  if (needs.productUrl) await applyProductUrls(resolvedList, adapter.key, tenantId);
  return resolvedList;
}

// NOTE: only stock_control === false skips lookup; eBay/Google differ on unset.
async function applyStock(resolvedList) {
  const tracked = resolvedList.filter((r) => r.product?.stock_control !== false);
  const pairs = tracked.map((r) => ({ productId: r.product._id, variantId: r.variant?._id || null }));
  const totals = await getTotalStockForProductVariants(pairs);
  for (const resolved of resolvedList) {
    const trackedItem = resolved.product?.stock_control !== false;
    resolved.stock = {
      stock_control: resolved.product?.stock_control,
      quantity: trackedItem ? totals.get(stockKey(resolved.product._id, resolved.variant?._id)) ?? 0 : null,
    };
  }
}

// Captures URL errors so the adapter raises them at its original point.
async function applyProductUrls(resolvedList, platform, tenantId) {
  let hostResult = null;
  for (const resolved of resolvedList) {
    try {
      assertProductSlug(resolved.product?.slug, resolved.sku);
      hostResult ??= await resolveStorefrontHost(tenantId, platform).then((host) => ({ host }), (error) => ({ error }));
      if (hostResult.error) throw hostResult.error;
      resolved.productUrl = buildProductUrl(hostResult.host, resolved.product.slug);
    } catch (err) {
      resolved.productUrlError = err;
    }
  }
}

// Category order: listing value -> tenant mapping -> unset.
async function applyMappedCategories(resolvedList, platform, tenantId) {
  const missing = resolvedList.filter((r) => !r.category?.id && r.product);
  if (!missing.length) return;
  const { resolveMappedCategories } = require("../categoryMapping.service");
  const byProduct = await resolveMappedCategories(tenantId, platform, missing.map((r) => r.product));
  for (const resolved of missing) resolved.category = byProduct.get(String(resolved.product._id)) || null;
}

module.exports = { resolveListing, resolveSku, resolveProductUrl, resolveIdentifiers, hydrateResolved };
