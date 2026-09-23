// services/search/product.search.schema.js
// Typesense collection schema for product search; kept separate so scripts/reindexProducts.js
// can (re)apply schema/synonyms without pulling in the indexing/search functions.

const { getTypesenseClient } = require("./typesense.client");
const { logger } = require("../../loaders/logging");

const PRODUCTS_COLLECTION = "products";

const PRODUCTS_SCHEMA = {
  name: PRODUCTS_COLLECTION,
  fields: [
    { name: "tenant_id", type: "string", facet: true },
    // sku/mpn weighted highest (see product.search.service.js) so exact part numbers outrank
    // title/description hits. infix so a partial number like "169" matches "PHA-000169".
    { name: "sku", type: "string", infix: true, optional: true },
    { name: "mpn", type: "string", infix: true, optional: true },
    { name: "title", type: "string" },
    // Despaced/lowercased copy of `title`, infix-indexed so "taillight" matches "Tail Light".
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

// Auto-parts domain synonyms, multi-way so a search on any one term matches the others.
const SYNONYM_SETS = [
  { id: "rim-wheel", synonyms: ["rim", "wheel"] },
  { id: "bonnet-hood", synonyms: ["bonnet", "hood"] },
  { id: "tyre-tire", synonyms: ["tyre", "tire"] },
  { id: "windscreen-windshield", synonyms: ["windscreen", "windshield"] },
];

// Typesense can't alter a field's infix/type in place — detects a schema change so drop+recreate
// happens automatically on next boot, without a manual step.
function schemaMatches(existing) {
  const existingInfix = new Map(existing.fields.map((f) => [f.name, !!f.infix]));
  return PRODUCTS_SCHEMA.fields.every((f) => existingInfix.get(f.name) === !!f.infix);
}

// Idempotent, safe on every boot. Typesense has no "create if not exists", so we probe first.
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
