// services/marketplace/brand-backfill.service.js
// Brandless parts not marked aftermarket get their vehicle make as brand.

const mongoose = require("mongoose");
const Product = require("../../models/Product");
const config = require("../../config");
const { logger } = require("../../loaders/logging");
const searchQueue = require("../../queues/search.queue");
const { PRODUCT_AUTHENTICITY, BRAND_BACKFILL_OUTCOME: BACKFILL_OUTCOME } = require("../../constants/product.constants");
const { createBrandResync } = require("./default-brand.service");

const OUTCOMES = Object.values(BACKFILL_OUTCOME);
const SAMPLE_SIZE = 5;

const trimmed = (value) => (typeof value === "string" ? value.trim() : "");

// NOTE: unset counts as genuine (owner's call); aftermarket never gets make.
const isEligibleAuthenticity = (value) => value == null || value === "" || value === PRODUCT_AUTHENTICITY.GENUINE;

// NOTE: first make in vehicle order (Vehicle 1, then the rest), i.e. make[0].
function firstMake(product) {
  if (trimmed(product.vehicle?.make)) return { make: product.vehicle.make, path: "vehicle.make" };
  const rows = Array.isArray(product.additional_fitments) ? product.additional_fitments : [];
  const index = rows.findIndex((row) => trimmed(row?.make));
  return index < 0 ? null : { make: rows[index].make, path: `additional_fitments.${index}.make` };
}

function classifyProduct(product) {
  if (trimmed(product.brand)) return BACKFILL_OUTCOME.ALREADY_BRANDED;
  if (product.authenticity === PRODUCT_AUTHENTICITY.AFTERMARKET) return BACKFILL_OUTCOME.AFTERMARKET;
  if (!isEligibleAuthenticity(product.authenticity)) return BACKFILL_OUTCOME.UNRECOGNISED_AUTHENTICITY;
  if (!firstMake(product)) return BACKFILL_OUTCOME.NO_MAKE;
  return BACKFILL_OUTCOME.SET;
}

// NOTE: only all-lowercase makes are recased, so "BMW" or "McLaren" stay as-is.
function toBrandName(make) {
  const name = trimmed(make).replace(/\s+/g, " ");
  if (name !== name.toLowerCase()) return name;
  return name.replace(/(^|[\s-])(\p{L})/gu, (_, sep, letter) => sep + letter.toUpperCase());
}

// Filter re-checks the read values, so a concurrent brand edit always wins.
function buildBrandOp(product) {
  const { make, path } = firstMake(product);
  return {
    updateOne: {
      filter: { _id: product._id, brand: product.brand ?? null, authenticity: product.authenticity ?? null, [path]: make },
      update: { $set: { brand: toBrandName(make) } },
    },
  };
}

// SET samples also show the brand to be written, for review before --confirm.
function sampleLabel(product, outcome) {
  const id = String(product._id);
  return outcome === BACKFILL_OUTCOME.SET ? `${id} -> ${toBrandName(firstMake(product).make)}` : id;
}

function emptyReport(tenantId) {
  return {
    tenantId: String(tenantId),
    counts: Object.fromEntries(OUTCOMES.map((o) => [o, 0])),
    samples: Object.fromEntries(OUTCOMES.map((o) => [o, []])),
    written: 0,
    resync: { listings: 0, jobs: 0 },
  };
}

// NOTE: one search job per product, as edits do; there is no bulk search job.
async function reindexForSearch(productIds) {
  for (const productId of productIds) {
    try {
      await searchQueue.enqueueSearchJob("index_product", { productId: String(productId) });
    } catch (err) {
      logger.warn(`[brand-backfill] search reindex not queued for ${productId}: ${err.message}`);
    }
  }
}

// NOTE: Meta/Google only, as asked; eBay picks the brand up on its next sync.
async function writeChunk(chunk, report, resync) {
  const result = await Product.bulkWrite(chunk.map(buildBrandOp), { ordered: false });
  report.written += result.modifiedCount;
  const ids = chunk.map((p) => p._id);
  await resync.addProducts(ids);
  await reindexForSearch(ids);
}

/** Classifies and (unless dryRun) writes one tenant's products. */
async function backfillTenant(tenantId, { dryRun, chunkSize }) {
  const report = emptyReport(tenantId);
  const resync = dryRun ? null : createBrandResync(tenantId);
  const cursor = Product.find({ tenant_id: tenantId })
    .select("_id brand authenticity vehicle.make additional_fitments.make")
    .lean()
    .cursor({ batchSize: chunkSize });

  let chunk = [];
  for (let product = await cursor.next(); product != null; product = await cursor.next()) {
    const outcome = classifyProduct(product);
    report.counts[outcome]++;
    if (report.samples[outcome].length < SAMPLE_SIZE) report.samples[outcome].push(sampleLabel(product, outcome));
    if (outcome !== BACKFILL_OUTCOME.SET || dryRun) continue;
    chunk.push(product);
    if (chunk.length < chunkSize) continue;
    await writeChunk(chunk, report, resync);
    chunk = [];
  }
  if (chunk.length) await writeChunk(chunk, report, resync);
  if (resync) report.resync = await resync.finish();
  return report;
}

// NOTE: soft-deleted products are skipped; Product.find already hides them.
async function tenantIdsInScope(tenantId) {
  if (tenantId) return [new mongoose.Types.ObjectId(String(tenantId))];
  const ids = await Product.distinct("tenant_id", { deleted_at: null });
  return ids.sort((a, b) => String(a).localeCompare(String(b)));
}

/** Per-tenant reports; dryRun (the default) writes and queues nothing. */
async function backfillBrandFromMake({ dryRun = true, tenantId = null, chunkSize = config.channels.batchChunkSize } = {}) {
  const reports = [];
  for (const id of await tenantIdsInScope(tenantId)) reports.push(await backfillTenant(id, { dryRun, chunkSize }));
  return reports;
}

module.exports = { backfillBrandFromMake, classifyProduct, toBrandName };
