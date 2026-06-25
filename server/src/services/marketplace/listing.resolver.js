// services/marketplace/listing.resolver.js
//
// Merges canonical Product (+ optional Variant) content with per-channel
// overrides stored on a MarketplaceListing. Every adapter reads its publish
// payload from the resolved object — never directly from the raw listing.

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

/**
 * Returns the resolved object that adapters use to build their publish payloads.
 *
 * @param {object} listing  - A MarketplaceListing document (or plain object)
 * @param {object} product  - The populated Product document
 * @param {object|null} variant - The populated ProductVariant document, or null
 */
function resolveListing(listing, product, variant = null) {
  const brand = listing.item_specifics?.brand || product.brand || null;

  return {
    sku: resolveSku(listing, product, variant),
    title: listing.title_override || product.title,
    description: listing.description_override || product.description || product.title,
    price: resolvePrice(listing, product, variant),
    brand,
    photos: resolvePhotos(listing, product, variant),
    // Pass raw documents through so adapters can read platform-specific fields
    listing: listing.toObject ? listing.toObject() : listing,
    product,
    variant,
  };
}

module.exports = { resolveListing, resolveSku };
