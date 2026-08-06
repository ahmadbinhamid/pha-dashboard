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
    { name: "sku", type: "string", optional: true },
    { name: "mpn", type: "string", optional: true },
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

// Idempotent — safe to call on every server/worker boot and from the
// reindex script. Typesense has no "create if not exists", so we probe first.
async function ensureProductsCollection() {
  const client = getTypesenseClient();
  try {
    await client.collections(PRODUCTS_COLLECTION).retrieve();
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
