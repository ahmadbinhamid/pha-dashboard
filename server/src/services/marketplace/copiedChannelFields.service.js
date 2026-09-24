// services/marketplace/copiedChannelFields.service.js
// Clears listing condition/authenticity/fitment that only copy the product's.

const mongoose = require("mongoose");
const MarketplaceListing = require("../../models/MarketplaceListing");
const Product = require("../../models/Product");
const config = require("../../config");
const { present, toFitmentRow, fitmentFromVehicle } = require("./productFallbacks");
const { toGoogleCondition } = require("./adapters/google.fieldSchema");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");

const { EBAY, GOOGLE } = MARKETPLACE_PLATFORM;
const FIELDS = ["ebay_condition", "google_condition", "authenticity", "fitment"];

// "Set" per field; native filters because these are discriminator-only paths.
const SET_FILTERS = {
  ebay_condition: { platform: EBAY, condition: { $nin: [null, ""] } },
  google_condition: { platform: GOOGLE, condition: { $nin: [null, ""] } },
  authenticity: { platform: EBAY, "item_specifics.authenticity": { $nin: [null, ""] } },
  fitment: { platform: EBAY, "fitment.0": { $exists: true } },
};

// Stored path and the value that means "use the product's".
const PATHS = {
  ebay_condition: ["condition", null],
  google_condition: ["condition", null],
  authenticity: ["item_specifics.authenticity", null],
  fitment: ["fitment", []],
};

// eBay pushes USED as USED_EXCELLENT (ebay.api.service#normalizeCondition).
const toEbayCondition = (value) => (value === "USED" ? "USED_EXCELLENT" : value);

function sameFitment(rows, vehicle) {
  const derived = fitmentFromVehicle(vehicle);
  return rows.length === 1 && derived.length === 1 && JSON.stringify(toFitmentRow(rows[0])) === JSON.stringify(derived[0]);
}

/** Which fields copy the product (cleared) and which are ambiguous (kept). */
function classifyListing(listing, product) {
  const copied = [];
  const ambiguous = [];
  const condition = present(listing.condition);
  if (listing.platform === EBAY) {
    if (condition && toEbayCondition(condition) === toEbayCondition(present(product.condition))) copied.push("ebay_condition");
    // NOTE: "NEW" was the old default, so this may be untouched, not chosen. Kept.
    else if (condition === "NEW") ambiguous.push("ebay_condition");

    const authenticity = present(listing.item_specifics?.authenticity);
    if (authenticity && authenticity === present(product.authenticity)) copied.push("authenticity");

    const rows = Array.isArray(listing.fitment) ? listing.fitment : [];
    if (rows.length && sameFitment(rows, product.vehicle)) copied.push("fitment");
  } else if (listing.platform === GOOGLE && condition && toGoogleCondition(condition) === toGoogleCondition(product.condition)) {
    copied.push("google_condition");
  }
  return { copied, ambiguous };
}

// Native queries don't cast, so a CLI string id becomes an ObjectId here.
const asTenantId = (id) => (id ? new mongoose.Types.ObjectId(String(id)) : null);

// Native reads: base-model queries would drop discriminator-only filters.
async function countSet(tenantId) {
  const scope = { deleted_at: null, ...(tenantId ? { tenant_id: tenantId } : {}) };
  const counts = await Promise.all(FIELDS.map((f) => MarketplaceListing.collection.countDocuments({ ...scope, ...SET_FILTERS[f] })));
  return Object.fromEntries(FIELDS.map((f, i) => [f, counts[i]]));
}

// Filter re-checks each stored value, so concurrent edits and re-runs are safe.
function buildClearOp(listing, fields) {
  const filter = { _id: listing._id };
  const $set = {};
  for (const field of fields) {
    const [path, cleared] = PATHS[field];
    const stored = path.split(".").reduce((v, k) => v?.[k], listing);
    filter[path] = stored;
    $set[path] = cleared;
  }
  return { updateOne: { filter, update: { $set } } };
}

async function processChunk(chunk, dryRun, totals) {
  const productIds = [...new Set(chunk.map((l) => String(l.product)))].map((id) => new mongoose.Types.ObjectId(id));
  const products = await Product.collection
    .find({ _id: { $in: productIds } }, { projection: { condition: 1, authenticity: 1, vehicle: 1 } })
    .toArray();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const ops = [];
  for (const listing of chunk) {
    const product = productById.get(String(listing.product));
    if (!product) continue; // orphaned listing: nothing to compare against
    const { copied, ambiguous } = classifyListing(listing, product);
    for (const field of ambiguous) {
      totals.ambiguous.count++;
      if (totals.ambiguous.sample.length < 5) totals.ambiguous.sample.push(String(listing._id));
    }
    if (!copied.length) continue;
    copied.forEach((field) => totals.cleared[field]++);
    ops.push(buildClearOp(listing, copied));
  }
  if (ops.length && !dryRun) await MarketplaceListing.collection.bulkWrite(ops, { ordered: false });
  return ops.length;
}

/** Clears copied fields; dryRun writes nothing and projects "after". */
async function clearCopiedChannelFields({ dryRun = false, tenantId: rawTenantId = null, chunkSize = config.channels.batchChunkSize } = {}) {
  const tenantId = asTenantId(rawTenantId);
  const before = await countSet(tenantId);
  const totals = { cleared: Object.fromEntries(FIELDS.map((f) => [f, 0])), ambiguous: { count: 0, sample: [] } };

  const query = { deleted_at: null, $or: FIELDS.map((f) => SET_FILTERS[f]) };
  if (tenantId) query.tenant_id = tenantId;
  const projection = { platform: 1, product: 1, condition: 1, "item_specifics.authenticity": 1, fitment: 1 };
  const cursor = MarketplaceListing.collection.find(query, { projection });

  let listingsTouched = 0;
  let chunk = [];
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    chunk.push(doc);
    if (chunk.length >= chunkSize) {
      listingsTouched += await processChunk(chunk, dryRun, totals);
      chunk = [];
    }
  }
  if (chunk.length) listingsTouched += await processChunk(chunk, dryRun, totals);

  const after = dryRun
    ? Object.fromEntries(FIELDS.map((f) => [f, before[f] - totals.cleared[f]]))
    : await countSet(tenantId);
  return { before, cleared: totals.cleared, after, ambiguous: totals.ambiguous, listingsTouched };
}

module.exports = { clearCopiedChannelFields, classifyListing, FIELDS };
