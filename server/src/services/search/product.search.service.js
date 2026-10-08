// services/search/product.search.service.js
// All Typesense reads/writes live here; callers never touch the client.

const { getTypesenseClient } = require("./typesense.client");
const { PRODUCTS_COLLECTION } = require("./product.search.schema");

// SKU/OEM(mpn) outrank title/brand, which outrank description.
const QUERY_BY = "sku,mpn,title,brand,description,title_flat";
const QUERY_BY_WEIGHTS = "5,4,3,2,1,3";
// Aligned with QUERY_BY; infix runs alongside token search, not instead.
const INFIX = "always,always,off,off,off,always";

function toSearchDocument(product) {
  return {
    id: product._id.toString(),
    tenant_id: product.tenant_id.toString(),
    sku: product.sku || "",
    mpn: product.mpn || "",
    title: product.title,
    title_flat: product.title.toLowerCase().replace(/\s+/g, ""),
    brand: product.brand || "",
    description: product.description || "",
    tags: product.tags || [],
    vehicle_make: product.vehicle?.make || "",
    vehicle_model: product.vehicle?.model || "",
    categories: (product.categories || []).map((c) => c.toString()),
    condition: product.condition || "",
    authenticity: product.authenticity || "",
    price: product.price || 0,
    rating: product.rating || 0,
    is_published_online: !!product.is_published_online,
    status: product.status,
  };
}

async function indexProduct(product) {
  const client = getTypesenseClient();
  await client
    .collections(PRODUCTS_COLLECTION)
    .documents()
    .upsert(toSearchDocument(product));
}

async function deleteProductFromIndex(productId) {
  const client = getTypesenseClient();
  try {
    await client
      .collections(PRODUCTS_COLLECTION)
      .documents(productId.toString())
      .delete();
  } catch (err) {
    // Already gone — not an error for callers.
    if (err.httpStatus !== 404) throw err;
  }
}

// Mirrors buildProductFilter so callers can pass req.query through as-is.
function buildFilterBy({ tenantId, categories, condition, authenticity, priceMin, priceMax, make, model, publishedOnly }) {
  const clauses = [`tenant_id:=${tenantId}`];
  if (publishedOnly) clauses.push("is_published_online:=true", "status:=active");
  if (condition) clauses.push(`condition:=${condition}`);
  if (authenticity) clauses.push(`authenticity:=${authenticity}`);
  if (make) clauses.push(`vehicle_make:=${make}`);
  if (model) clauses.push(`vehicle_model:=${model}`);
  if (categories?.length) clauses.push(`categories:=[${categories.join(",")}]`);
  if (priceMin !== undefined) clauses.push(`price:>=${priceMin}`);
  if (priceMax !== undefined) clauses.push(`price:<=${priceMax}`);
  return clauses.join(" && ");
}

// Infix hits all score the same floor, so try sku, then mpn, before all fields.
const PART_NUMBER_TIERS = [
  { query_by: "sku", query_by_weights: "5", infix: "always" },
  { query_by: "mpn", query_by_weights: "4", infix: "always" },
];

// Part numbers carry digits in every token; "JEEP ... BRACKET" is a title.
function looksLikePartNumber(q) {
  const tokens = q.trim().split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => /\d/.test(t));
}

async function runPartNumberFirstSearch(client, { q, filterBy, page, perPage, prefix }) {
  const tiers = looksLikePartNumber(q) ? PART_NUMBER_TIERS : [];
  for (const tier of tiers) {
    const result = await client
      .collections(PRODUCTS_COLLECTION)
      .documents()
      .search({
        q,
        ...tier,
        prefix: !!prefix,
        num_typos: 2,
        // NOTE: default token dropping lets a partial match short-circuit tiers.
        drop_tokens_threshold: 0,
        filter_by: filterBy,
        page,
        per_page: perPage,
      });
    if (result.found > 0) return result;
  }

  return client
    .collections(PRODUCTS_COLLECTION)
    .documents()
    .search({
      q,
      query_by: QUERY_BY,
      query_by_weights: QUERY_BY_WEIGHTS,
      infix: INFIX,
      prefix: !!prefix,
      num_typos: 2,
      filter_by: filterBy,
      page,
      per_page: perPage,
    });
}

// Returns ordered ids + total; callers hydrate documents from Mongo.
async function searchProducts({ q, page = 1, perPage = 20, ...filters }) {
  const client = getTypesenseClient();
  const searchTerm = q || "*";
  const filterBy = buildFilterBy(filters);

  // "*" (browse-all) has no part number to prioritize; use the normal search.
  const result = searchTerm === "*"
    ? await client.collections(PRODUCTS_COLLECTION).documents().search({
        q: searchTerm,
        query_by: QUERY_BY,
        query_by_weights: QUERY_BY_WEIGHTS,
        infix: INFIX,
        num_typos: 2,
        filter_by: filterBy,
        page,
        per_page: perPage,
      })
    : await runPartNumberFirstSearch(client, { q: searchTerm, filterBy, page, perPage });

  return {
    ids: (result.hits || []).map((hit) => hit.document.id),
    total: result.found || 0,
  };
}

// Ranking only; the controller hydrates so one place shapes product cards.
async function suggestProducts({ tenantId, q, limit = 6 }) {
  const client = getTypesenseClient();
  const result = await runPartNumberFirstSearch(client, {
    q,
    filterBy: buildFilterBy({ tenantId, publishedOnly: true }),
    page: 1,
    perPage: limit,
    prefix: true,
  });

  return {
    ids: (result.hits || []).map((hit) => hit.document.id),
    total: result.found || 0,
  };
}

module.exports = {
  toSearchDocument,
  indexProduct,
  deleteProductFromIndex,
  searchProducts,
  suggestProducts,
};
