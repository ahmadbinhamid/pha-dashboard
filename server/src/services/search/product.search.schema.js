// services/search/product.search.schema.js
//
// Typesense collection schema for product full-text/fuzzy search. Kept
// separate from product.search.service.js so the schema/synonyms can be
// (re)applied independently by scripts/reindexProducts.js without pulling in
// the indexing/search functions.

const { getTypesenseClient } = require("./typesense.client");
const { logger } = require("../../loaders/logging");

const PRODUCTS_COLLECTION = "products";

const PRODUCTS_SCHEMA = {
  name: PRODUCTS_COLLECTION,
  fields: [
    { name: "tenant_id", type: "string", facet: true },
    // sku/mpn weighted highest in query_by_weights (see product.search.service.js),
    // matching an eBay/Amazon-style ranking: exact part-number matches
    // outrank a title/description hit.
    // infix so a partial SKU/OEM number like "169" matches "PHA-000169" —
    // without it, Typesense only prefix-matches per token ("PHA"/"000169"),
    // and "169" isn't a prefix of "000169".
    { name: "sku", type: "string", infix: true, optional: true },
    { name: "mpn", type: "string", infix: true, optional: true },
    { name: "title", type: "string" },
    // Despaced/lowercased copy of `title`, infix-indexed — Typesense's
    // tokenizer doesn't split compound words, so a query like "taillight"
    // (no space) would otherwise never match a title stored as "Tail Light"
    // (two tokens). Infix search on this flattened field catches that case
    // in either direction. See product.search.service.js's QUERY_BY/INFIX.
    { name: "title_flat", type: "string", infix: true, optional: true },
    { name: "brand", type: "string", facet: true, optional: true },
    { name: "description", type: "string", optional: true },
    { name: "tags", type: "string[]", facet: true, optional: true },
    { name: "vehicle_make", type: "string", facet: true, optional: true },
    { name: "vehicle_model", type: "string", facet: true, optional: true },
    { name: "categories", type: "string[]", facet: true, optional: true },
    { name: "condition", type: "string", facet: true, optional: true },
    { name: "authenticity", type: "string", facet: true, optional: true },
    { name: "price", type: "float" },
    { name: "rating", type: "float" },
    { name: "is_published_online", type: "bool" },
    { name: "status", type: "string" },
  ],
  default_sorting_field: "rating",
};

// Auto-parts domain synonyms — multi-way so a search on any one term also
// matches the others.
const SYNONYM_SETS = [
  { id: "rim-wheel", synonyms: ["rim", "wheel"] },
  { id: "bonnet-hood", synonyms: ["bonnet", "hood"] },
  { id: "tyre-tire", synonyms: ["tyre", "tire"] },
  { id: "windscreen-windshield", synonyms: ["windscreen", "windshield"] },
];

// Typesense can't alter a field's `infix`/`type` in place — the only way to
// change it is drop + recreate. Detects that case (rather than silently
// keeping a stale schema forever) so a schema edit like this one takes
// effect the next time the server/reindex script boots, without a separate
// manual "drop the collection" step every time.
function schemaMatches(existing) {
  const existingInfix = new Map(existing.fields.map((f) => [f.name, !!f.infix]));
  return PRODUCTS_SCHEMA.fields.every((f) => existingInfix.get(f.name) === !!f.infix);
}

// Idempotent — safe to call on every server/worker boot and from the
// reindex script. Typesense has no "create if not exists", so we probe first.
async function ensureProductsCollection() {
  const client = getTypesenseClient();
  try {
    const existing = await client.collections(PRODUCTS_COLLECTION).retrieve();
    if (!schemaMatches(existing)) {
      logger.info(`[typesense] "${PRODUCTS_COLLECTION}" schema changed — dropping and recreating`);
      await client.collections(PRODUCTS_COLLECTION).delete();
      await client.collections().create(PRODUCTS_SCHEMA);
      logger.info(`[typesense] recreated collection "${PRODUCTS_COLLECTION}" (reindex required)`);
    }
  } catch (err) {
    if (err.httpStatus !== 404) throw err;
    await client.collections().create(PRODUCTS_SCHEMA);
    logger.info(`[typesense] created collection "${PRODUCTS_COLLECTION}"`);
  }

  for (const set of SYNONYM_SETS) {
    await client
      .collections(PRODUCTS_COLLECTION)
      .synonyms()
      .upsert(set.id, { synonyms: set.synonyms });
  }
}

module.exports = { PRODUCTS_COLLECTION, PRODUCTS_SCHEMA, ensureProductsCollection };
