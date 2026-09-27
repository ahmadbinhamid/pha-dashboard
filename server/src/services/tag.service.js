// services/tag.service.js
// Tag print queue, print history and tag style; owns all tag model access.

const TagQueueItem = require("../models/TagQueueItem");
const TagPrintLog = require("../models/TagPrintLog");
const TagSettings = require("../models/TagSettings");
const Product = require("../models/Product");
// Registers the model the added_by / printed_by populates resolve.
require("../models/User");
const { getTotalStockForProducts } = require("./inventory.service");
const { findProductById } = require("./product.service");
const { httpError } = require("../utils/http/httpError");
const {
  MAX_TAG_COPIES,
  TAG_PRINT_SOURCE,
  TAG_QUEUE_MODE,
  TAG_FIELD,
  DEFAULT_TAG_FIELDS,
  DEFAULT_TAG_STYLE,
} = require("../constants/tag.constants");

const TAG_PRODUCT_FIELDS = "title sku bay slug internal_notes";
const USER_NAME_FIELDS = "first_name last_name";
const IMPORT_CHUNK_SIZE = 500;

const userName = (user) => (user ? `${user.first_name} ${user.last_name}`.trim() : null);

// NOTE: no over-printing: at most one tag per unit (1 if out of stock).
function clampCopies(n, stock) {
  const ceiling = Math.min(Math.max(stock ?? MAX_TAG_COPIES, 1), MAX_TAG_COPIES);
  return Math.min(Math.max(Math.floor(n) || 1, 1), ceiling);
}

async function stockOf(productId) {
  return (await getTotalStockForProducts([productId])).get(String(productId)) ?? 0;
}

function latestNote(notes = []) {
  const latest = [...notes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  return latest?.text ?? null;
}

// Just what a printed tag needs; the full notes thread stays server-side.
function toTagProduct(product) {
  return {
    _id: product._id,
    title: product.title,
    sku: product.sku ?? null,
    bay: product.bay ?? null,
    slug: product.slug,
    note: latestNote(product.internal_notes),
  };
}

/** Queue rows, newest first, each with its product's current stock. */
async function listQueue(tenantId) {
  const rows = await TagQueueItem.find({ tenant_id: tenantId })
    .sort({ created_at: -1 })
    .populate({ path: "product", select: TAG_PRODUCT_FIELDS })
    .populate({ path: "added_by", select: USER_NAME_FIELDS })
    .lean();
  // A product deleted since it was queued populates as null; hide it.
  const live = rows.filter((r) => r.product);
  const stock = await getTotalStockForProducts(live.map((r) => r.product._id));
  return live.map((r) => ({
    _id: r._id,
    copies: r.copies,
    added_by: userName(r.added_by),
    created_at: r.created_at,
    product: toTagProduct(r.product),
    stock_count: stock.get(String(r.product._id)) ?? 0,
  }));
}

/** Queues a product. Omitted copies = whole stock; "increment" adds on. */
async function addToQueue(tenantId, userId, { product_id, copies, mode = TAG_QUEUE_MODE.SET }) {
  const product = await findProductById(product_id, tenantId);
  if (!product) throw httpError("Product not found", 404);
  const stock = await stockOf(product._id);
  const filter = { tenant_id: tenantId, product: product._id };
  const existing = mode === TAG_QUEUE_MODE.INCREMENT ? await TagQueueItem.findOne(filter).select("copies").lean() : null;
  const requested = (existing?.copies ?? 0) + (copies ?? (mode === TAG_QUEUE_MODE.INCREMENT ? 1 : stock));
  return TagQueueItem.findOneAndUpdate(
    filter,
    { $set: { copies: clampCopies(requested, stock), added_by: userId ?? null } },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
  );
}

async function updateQueueItem(tenantId, id, { copies }) {
  const item = await TagQueueItem.findOne({ _id: id, tenant_id: tenantId }).select("product").lean();
  if (!item) return null;
  return TagQueueItem.findOneAndUpdate(
    { _id: id, tenant_id: tenantId },
    { $set: { copies: clampCopies(copies, await stockOf(item.product)) } },
    { new: true, runValidators: true },
  );
}

async function removeQueueItem(tenantId, id) {
  const { deletedCount } = await TagQueueItem.deleteOne({ _id: id, tenant_id: tenantId });
  return deletedCount > 0;
}

async function clearQueue(tenantId) {
  const { deletedCount } = await TagQueueItem.deleteMany({ tenant_id: tenantId });
  return deletedCount;
}

// Queues one chunk of never-printed products that have stock.
async function queueUnprintedChunk(tenantId, userId, productIds) {
  const stock = await getTotalStockForProducts(productIds);
  const ops = productIds
    .filter((id) => (stock.get(String(id)) ?? 0) > 0)
    .map((id) => ({
      updateOne: {
        filter: { tenant_id: tenantId, product: id },
        // $setOnInsert: never overwrite a row someone queued meanwhile.
        update: { $setOnInsert: { copies: clampCopies(stock.get(String(id))), added_by: userId ?? null } },
        upsert: true,
      },
    }));
  if (!ops.length) return { added: 0, skipped: productIds.length };
  const result = await TagQueueItem.bulkWrite(ops, { ordered: false });
  return { added: result.upsertedCount, skipped: productIds.length - result.upsertedCount };
}

/** Queues every in-stock product never printed, one tag per unit. */
async function importUnprinted(tenantId, userId) {
  const [printed, queued] = await Promise.all([
    TagPrintLog.distinct("items.product", { tenant_id: tenantId }),
    TagQueueItem.distinct("product", { tenant_id: tenantId }),
  ]);
  const cursor = Product.find({ tenant_id: tenantId, _id: { $nin: [...printed, ...queued] } })
    .select("_id")
    .lean()
    .cursor({ batchSize: IMPORT_CHUNK_SIZE });

  const totals = { added: 0, skipped_out_of_stock: 0 };
  let chunk = [];
  const flush = async () => {
    const { added, skipped } = await queueUnprintedChunk(tenantId, userId, chunk);
    totals.added += added;
    totals.skipped_out_of_stock += skipped;
    chunk = [];
  };
  for await (const doc of cursor) {
    chunk.push(doc._id);
    if (chunk.length >= IMPORT_CHUNK_SIZE) await flush();
  }
  if (chunk.length) await flush();
  return totals;
}

// Snapshots each product so history still reads right after edits.
async function snapshotItems(tenantId, items) {
  const ids = items.map((i) => i.product_id);
  const products = await Product.find({ _id: { $in: ids }, tenant_id: tenantId }).select("title sku bay").lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  return items
    .filter((i) => byId.has(String(i.product_id)))
    .map((i) => {
      const p = byId.get(String(i.product_id));
      return { product: p._id, sku: p.sku ?? null, title: p.title, bay: p.bay ?? null, copies: clampCopies(i.copies) };
    });
}

/** Logs a print run; a queue run also removes the printed rows. */
async function recordPrint(tenantId, userId, { source, items }) {
  const snapshot = await snapshotItems(tenantId, items);
  if (!snapshot.length) throw httpError("None of those products exist", 400);
  const log = await TagPrintLog.create({
    tenant_id: tenantId,
    source,
    printed_by: userId ?? null,
    items: snapshot,
    total_tags: snapshot.reduce((sum, i) => sum + i.copies, 0),
  });
  if (source === TAG_PRINT_SOURCE.QUEUE) {
    await TagQueueItem.deleteMany({ tenant_id: tenantId, product: { $in: snapshot.map((i) => i.product) } });
  }
  return log;
}

async function listHistory(tenantId, { page, limit, skip }) {
  const filter = { tenant_id: tenantId };
  const [rows, total] = await Promise.all([
    TagPrintLog.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).populate({ path: "printed_by", select: USER_NAME_FIELDS }).lean(),
    TagPrintLog.countDocuments(filter),
  ]);
  return {
    items: rows.map((r) => ({ ...r, printed_by: userName(r.printed_by) })),
    total,
    page,
    pageSize: limit,
    totalPages: Math.max(Math.ceil(total / limit), 1),
  };
}

// Pre-field styles stored show_* flags and a title_size; map them over.
const LEGACY_TITLE_PT = { sm: 7, md: 8, lg: 9.5 };
function legacyFields(doc) {
  const legacyVisible = { [TAG_FIELD.NOTE]: doc.show_note, [TAG_FIELD.STOCK_NUMBER]: doc.show_stock_number, [TAG_FIELD.BAY]: doc.show_bay };
  return DEFAULT_TAG_FIELDS.map((f) => ({
    ...f,
    visible: legacyVisible[f.key] ?? f.visible,
    size_pt: f.key === TAG_FIELD.TITLE ? LEGACY_TITLE_PT[doc.title_size] ?? f.size_pt : f.size_pt,
  }));
}

// Saved order first, then any field added since, so every key is present.
function normalizeFields(fields) {
  const byKey = new Map(DEFAULT_TAG_FIELDS.map((f) => [f.key, f]));
  const saved = fields.filter((f) => byKey.has(f.key)).map((f) => ({ ...byKey.get(f.key), ...f }));
  const missing = DEFAULT_TAG_FIELDS.filter((f) => !saved.some((s) => s.key === f.key));
  return [...saved, ...missing].map(({ key, visible, size_pt, bold }) => ({ key, visible, size_pt, bold }));
}

function toStyle(doc = {}) {
  return {
    font: doc.font ?? DEFAULT_TAG_STYLE.font,
    qr_position: doc.qr_position ?? DEFAULT_TAG_STYLE.qr_position,
    align: doc.align ?? DEFAULT_TAG_STYLE.align,
    line_spacing: doc.line_spacing ?? DEFAULT_TAG_STYLE.line_spacing,
    margin_mm: doc.margin_mm ?? DEFAULT_TAG_STYLE.margin_mm,
    fields: normalizeFields(doc.fields?.length ? doc.fields : legacyFields(doc)),
  };
}

async function getStyle(tenantId) {
  const doc = await TagSettings.findOneAndUpdate(
    { tenant_id: tenantId },
    { $setOnInsert: { tenant_id: tenantId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return toStyle(doc);
}

async function updateStyle(tenantId, patch) {
  const style = toStyle({ ...(await getStyle(tenantId)), ...patch });
  const doc = await TagSettings.findOneAndUpdate(
    { tenant_id: tenantId },
    { $set: style, $unset: { show_note: 1, show_stock_number: 1, show_bay: 1, title_size: 1 } },
    { upsert: true, new: true, runValidators: true, strict: false },
  ).lean();
  return toStyle(doc);
}

module.exports = {
  listQueue,
  addToQueue,
  updateQueueItem,
  removeQueueItem,
  clearQueue,
  importUnprinted,
  recordPrint,
  listHistory,
  getStyle,
  updateStyle,
};
