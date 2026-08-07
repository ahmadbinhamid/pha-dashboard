// services/search/product.search.service.js
//
// All Typesense reads/writes live here — controllers/queue workers never
// touch the client directly, same discipline as Mongoose calls staying in
// *.service.js files.

const { getTypesenseClient } = require("./typesense.client");
const { PRODUCTS_COLLECTION } = require("./product.search.schema");

// SKU/OEM(mpn) matches outrank title/brand, which outrank a description hit —
// mirrors an eBay/Amazon-style boost order (SKU highest, then OEM/mpn, then
// name, brand, description). title_flat (compound-word/infix fallback — see
// the schema field's comment) sits at the same weight as title itself.
const QUERY_BY = "sku,mpn,title,brand,description,title_flat";
const QUERY_BY_WEIGHTS = "5,4,3,2,1,3";
// Positionally aligned with QUERY_BY — infix runs on sku/mpn (partial part
// numbers) and title_flat (compound words), "always" alongside the regular
// token search on every field (never instead of it).
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
    // Already gone (never indexed, or deleted twice) — not an error for callers.
    if (err.httpStatus !== 404) throw err;
  }
}

// Structured filters mirror buildProductFilter's own field names/semantics
// so callers can pass the same req.query through untouched.
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

// Typesense scores every infix match at the same low, flat floor regardless
// of which field matched or how deep into it — so a query like "033" gets
// identical scores whether it's a real substring of the product's own SKU
// ("PHA-000033"), an unrelated product's OEM/mpn number ("LR033415"), or
// just happens to appear inside some product's title. query_by_weights can't
// break that tie (weights only matter between different scores), and every
// product's `rating` sits at 0 (nothing sets the default_sorting_field
// tiebreaker either), so results land in arbitrary order — a product's own
// SKU match can end up ranked below (or after) an unrelated product that
// merely contains the digits somewhere else. Fix: search progressively
// narrower/higher-intent fields first — sku alone, then mpn alone, then
// everything — and stop at the first tier that finds anything, so a real SKU
// hit always wins outright instead of being tied against weaker matches.
const PART_NUMBER_TIERS = [
  { query_by: "sku", query_by_weights: "5", infix: "always" },
  { query_by: "mpn", query_by_weights: "4", infix: "always" },
];

async function runPartNumberFirstSearch(client, { q, filterBy, page, perPage, prefix }) {
  for (const tier of PART_NUMBER_TIERS) {
    const result = await client
      .collections(PRODUCTS_COLLECTION)
      .documents()
      .search({
        q,
        ...tier,
        prefix: !!prefix,
        num_typos: 2,
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

// Returns ordered product ids + total — callers hydrate full documents from
// Mongo themselves (see product.service.js#getProductsByIds) so joins (stock,
// attachments, categories) stay on the existing aggregation pipeline.
async function searchProducts({ q, page = 1, perPage = 20, ...filters }) {
  const client = getTypesenseClient();
  const searchTerm = q || "*";
  const filterBy = buildFilterBy(filters);

  // "*" (browse-all, no query) has no part number to prioritize — skip
  // straight to the normal search, no point running an extra empty pass.
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

// Returns ordered ids only, same as searchProducts — the controller hydrates
// full (title/slug/sku/price/image) documents from Mongo via
// product.service.js#getProductSuggestions, so Typesense stays purely the
// ranking/matching layer and there's only one place that shapes a "product
// card" response.
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
