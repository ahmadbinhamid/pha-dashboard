// services/marketplace/listingOverride.service.js
// Clears listing overrides that just copy the product value (old form prefill).

const MarketplaceListing = require("../../models/MarketplaceListing");
const Product = require("../../models/Product");
const ProductVariant = require("../../models/ProductVariant");
const config = require("../../config");
const { resolveListing } = require("./listing.resolver");
const { isGeneratedEbayDescription } = require("../ebay/ebay.description.template");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");

const OVERRIDE_FIELDS = ["title_override", "description_override", "price_override", "photo_overrides"];

// Mongo filter for "override is set", per field.
const SET_FILTERS = {
  title_override: { title_override: { $nin: [null, ""] } },
  description_override: { description_override: { $nin: [null, ""] } },
  price_override: { price_override: { $ne: null } },
  photo_overrides: { "photo_overrides.0": { $exists: true } },
};

// Schema default that clears each field.
const CLEARED_VALUE = { title_override: null, description_override: null, price_override: null, photo_overrides: [] };

function idsOf(list) {
  return (list || []).map((a) => String(a?._id ?? a));
}

function sameIds(a, b) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

// What the resolver would push with no overrides at all.
function valuesWithoutOverrides(listing, product, variant) {
  const bare = { ...listing, ...CLEARED_VALUE };
  const resolved = resolveListing(bare, product, variant);
  return { title: resolved.title, description: resolved.description, price: resolved.price, photoIds: idsOf(resolved.photos) };
}

// Overrides whose removal leaves the pushed value unchanged.
function findCopiedFields(listing, product, variant, { includeGeneratedDescriptions = false } = {}) {
  const base = valuesWithoutOverrides(listing, product, variant);
  const copied = [];

  if (listing.title_override && listing.title_override === base.title) copied.push("title_override");
  if (listing.price_override != null && listing.price_override === base.price) copied.push("price_override");

  const overridePhotoIds = idsOf(listing.photo_overrides);
  if (overridePhotoIds.length && sameIds(overridePhotoIds, base.photoIds)) copied.push("photo_overrides");

  const description = listing.description_override;
  if (description) {
    // NOTE: eBay renders a template when unset; clearing it is opt-in only.
    if (listing.platform === MARKETPLACE_PLATFORM.EBAY) {
      if (includeGeneratedDescriptions && isGeneratedEbayDescription(description)) copied.push("description_override");
    } else if (description === base.description) {
      copied.push("description_override");
    }
  }
  return copied;
}

async function countOverrides(tenantId) {
  const scope = tenantId ? { tenant_id: tenantId } : {};
  const counts = await Promise.all(
    OVERRIDE_FIELDS.map((field) => MarketplaceListing.countDocuments({ ...scope, ...SET_FILTERS[field] })),
  );
  return Object.fromEntries(OVERRIDE_FIELDS.map((field, i) => [field, counts[i]]));
}

// One batched product + variant lookup per chunk.
async function loadChunkSources(chunk) {
  const productIds = [...new Set(chunk.map((l) => String(l.product)))];
  const variantIds = [...new Set(chunk.filter((l) => l.variant).map((l) => String(l.variant)))];
  const [products, variants] = await Promise.all([
    Product.find({ _id: { $in: productIds } }).select("title description price attachments").lean(),
    variantIds.length
      ? ProductVariant.find({ _id: { $in: variantIds } }).select("price attachments").lean()
      : Promise.resolve([]),
  ]);
  return {
    productById: new Map(products.map((p) => [String(p._id), p])),
    variantById: new Map(variants.map((v) => [String(v._id), v])),
  };
}

// Filter re-checks the stored value, so concurrent edits and re-runs are safe.
function buildClearOp(listing, fields) {
  const filter = { _id: listing._id };
  const $set = {};
  for (const field of fields) {
    filter[field] = listing[field];
    $set[field] = CLEARED_VALUE[field];
  }
  return { updateOne: { filter, update: { $set } } };
}

async function processChunk(chunk, opts, totals) {
  const { productById, variantById } = await loadChunkSources(chunk);
  const ops = [];
  for (const listing of chunk) {
    const product = productById.get(String(listing.product));
    if (!product) continue; // orphaned listing — nothing to compare against
    const variant = listing.variant ? variantById.get(String(listing.variant)) || null : null;
    const fields = findCopiedFields(listing, product, variant, opts);
    if (!fields.length) continue;
    for (const field of fields) totals[field]++;
    ops.push(buildClearOp(listing, fields));
  }
  if (ops.length && !opts.dryRun) await MarketplaceListing.bulkWrite(ops, { ordered: false });
  return ops.length;
}

/** Clears copied overrides; dryRun writes nothing and projects "after". */
async function clearCopiedOverrides({
  dryRun = false,
  tenantId = null,
  includeGeneratedDescriptions = false,
  chunkSize = config.channels.batchChunkSize,
} = {}) {
  const before = await countOverrides(tenantId);
  const cleared = Object.fromEntries(OVERRIDE_FIELDS.map((f) => [f, 0]));
  const opts = { dryRun, includeGeneratedDescriptions };

  const query = { $or: OVERRIDE_FIELDS.map((f) => SET_FILTERS[f]) };
  if (tenantId) query.tenant_id = tenantId;
  const cursor = MarketplaceListing.find(query)
    .select(["platform", "product", "variant", ...OVERRIDE_FIELDS].join(" "))
    .lean()
    .cursor();

  let listingsTouched = 0;
  let chunk = [];
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    chunk.push(doc);
    if (chunk.length >= chunkSize) {
      listingsTouched += await processChunk(chunk, opts, cleared);
      chunk = [];
    }
  }
  if (chunk.length) listingsTouched += await processChunk(chunk, opts, cleared);

  const after = dryRun
    ? Object.fromEntries(OVERRIDE_FIELDS.map((f) => [f, before[f] - cleared[f]]))
    : await countOverrides(tenantId);
  return { before, after, cleared, listingsTouched };
}

module.exports = { clearCopiedOverrides, countOverrides, findCopiedFields, OVERRIDE_FIELDS };
