// middlewares/validateListing.js
// Picks a platform's listing schema: body.platform on create, stored on update.

const mongoose = require("mongoose");
const validate = require("./validate");
const registry = require("../services/marketplace/registry");
const { hasListingWriter, findListingPlatform } = require("../services/marketplace/listing.write.service");
const { LISTING_WRITE_SCHEMAS } = require("../validators/listing.validation");
const { badRequest, notFound } = require("../utils/http/response");

/** Fixes the platform for a deprecated per-platform alias route. */
const forPlatform = (platform) => (req, _res, next) => {
  req.listingPlatform = platform;
  next();
};

const isWritablePlatform = (platform) =>
  typeof platform === "string" && registry.has(platform) && hasListingWriter(platform);

function validateListingCreate(req, res, next) {
  const platform = req.listingPlatform ?? req.body?.platform;
  if (!isWritablePlatform(platform)) return badRequest(res, `Unknown listing platform: ${platform ?? "(none)"}`);
  req.listingPlatform = platform;
  return validate(LISTING_WRITE_SCHEMAS[platform].create)(req, res, next);
}

// Platform the update must validate as, or null when the caller can't see it.
async function resolveUpdatePlatform(id, tenantId, fixed) {
  const stored = await findListingPlatform(id, tenantId);
  // NOTE: an alias can't update another platform's listing (it once could).
  return !stored || (fixed && stored !== fixed) || !hasListingWriter(stored) ? null : stored;
}

function validateListingUpdate(req, res, next) {
  const fixed = req.listingPlatform;
  // NOTE: a malformed id gets the alias's own schema response, as before.
  if (!mongoose.isValidObjectId(req.params.id)) {
    return fixed ? validate(LISTING_WRITE_SCHEMAS[fixed].update)(req, res, next) : badRequest(res, "Invalid listing id");
  }
  return resolveUpdatePlatform(req.params.id, req.tenantId, fixed).then((platform) => {
    if (!platform) return notFound(res, "Listing not found");
    req.listingPlatform = platform;
    return validate(LISTING_WRITE_SCHEMAS[platform].update)(req, res, next);
  }, next);
}

module.exports = {
  forPlatform,
  validateListingCreate,
  validateListingUpdate,
};
