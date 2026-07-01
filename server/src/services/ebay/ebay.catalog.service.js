// services/ebay/ebay.catalog.service.js
// eBay Taxonomy (category suggestions) and Sell Metadata (condition policies)

const config = require("../../config");
const { getAccessToken, getCatalogToken, ebayHeaders } = require("./ebay.api.service");
const { logger } = require("../../loaders/logging");

const BASE_URL = config.ebay.apiBaseUrl;
const TAXONOMY_BASE = config.ebay.taxonomyBaseUrl;
const METADATA_BASE = `${BASE_URL}/sell/metadata/v1`;
const ACCOUNT_BASE = `${BASE_URL}/sell/account/v1`;

// ── In-memory caches ──────────────────────────────────────────────────────────

let _treeId = null;

const _conditionCache = new Map();
const CONDITION_TTL_MS = 30 * 60 * 1000; // 30 minutes

let _storeCategoriesCache = null;
let _storeCacheExpiry = 0;
const STORE_CATEGORIES_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Category tree ID (cached indefinitely — eBay tree IDs are very stable) ────

async function getCategoryTreeId(token) {
  if (_treeId) return _treeId;

  const res = await fetch(
    `${TAXONOMY_BASE}/get_default_category_tree_id?marketplace_id=${config.ebay.marketplaceId}`,
    { headers: ebayHeaders(token) },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getDefaultCategoryTreeId failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  _treeId = data.categoryTreeId;
  logger.info(`[eBay catalog] cached category tree id: ${_treeId}`);
  return _treeId;
}

// ── Category suggestions ──────────────────────────────────────────────────────
// Sandbox caveat: eBay's getCategorySuggestions endpoint is not functional in
// sandbox — it returns boilerplate rather than real suggestions. When
// config.ebay.sandbox is true we return a { sandbox: true } sentinel so the
// frontend can fall back to the manual ID input without showing fake data.

async function getCategorySuggestions(q) {
  if (config.ebay.sandbox) {
    return { sandbox: true, suggestions: [] };
  }

  const token = await getCatalogToken();
  if (!token) throw new Error("Could not obtain eBay catalog token");

  const treeId = await getCategoryTreeId(token);
  const url = `${TAXONOMY_BASE}/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(q)}`;

  const res = await fetch(url, { headers: ebayHeaders(token) });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getCategorySuggestions failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  const suggestions = (data.categorySuggestions || []).map((s) => {
    // Ancestors arrive in arbitrary order — sort ascending by tree level
    const ancestors = (s.categoryTreeNodeAncestors || [])
      .slice()
      .sort((a, b) => a.categoryTreeNodeLevel - b.categoryTreeNodeLevel);
    const breadcrumb = [
      ...ancestors.map((a) => a.categoryName),
      s.category.categoryName,
    ].join(" › ");
    return {
      categoryId: s.category.categoryId,
      categoryName: s.category.categoryName,
      breadcrumb,
    };
  });

  return { sandbox: false, suggestions };
}

// ── Condition ID → ConditionEnum mapping ─────────────────────────────────────
// The Sell Metadata API returns numeric conditionIds (e.g. 1000, 7000) but
// the Sell Inventory API's inventory_item endpoint expects the string enum
// (e.g. "NEW", "FOR_PARTS_OR_NOT_WORKING"). We remap at this layer so the
// stored ebay_condition value is always the enum string the Inventory API needs.

const CONDITION_ID_TO_ENUM = {
  1000: "NEW",
  1500: "NEW_OTHER",
  1750: "NEW_WITH_DEFECTS",
  2000: "CERTIFIED_REFURBISHED",
  2010: "EXCELLENT_REFURBISHED",
  2020: "VERY_GOOD_REFURBISHED",
  2030: "GOOD_REFURBISHED",
  2500: "SELLER_REFURBISHED",
  2750: "LIKE_NEW",
  3000: "USED_EXCELLENT",
  4000: "USED_VERY_GOOD",
  5000: "USED_GOOD",
  6000: "USED_ACCEPTABLE",
  7000: "FOR_PARTS_OR_NOT_WORKING",
};

// ── Condition policies ────────────────────────────────────────────────────────
// Uses the Sell Metadata API filtered to a single categoryId so we never
// download the full tree. Standard conditions are available with the seller
// access token; refurbished conditions (SELLER_REFURBISHED, etc.) would
// additionally require the sell.inventory scope to be reflected.

async function getConditionPolicies(categoryId) {
  const cached = _conditionCache.get(categoryId);
  if (cached && Date.now() < cached.expiry) return cached.data;

  const token = await getAccessToken();
  if (!token) throw new Error("Could not obtain eBay access token");

  // filter=categoryIds:{id} selects exactly this one category
  const filter = `categoryIds:{${categoryId}}`;
  const url = `${METADATA_BASE}/marketplace/${config.ebay.marketplaceId}/get_item_condition_policies?filter=${encodeURIComponent(filter)}`;

  const res = await fetch(url, { headers: ebayHeaders(token) });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getItemConditionPolicies failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const policies = data.itemConditionPolicies || [];
  const policy = policies.find((p) => p.categoryId === categoryId) || policies[0];

  const result = policy
    ? {
        conditionRequired: !!policy.conditionRequired,
        conditions: (policy.itemConditions || []).map((c) => ({
          // conditionId here is the ConditionEnum string the Inventory API accepts,
          // not the raw numeric id — callers store this directly as ebay_condition.
          conditionId: CONDITION_ID_TO_ENUM[Number(c.conditionId)] || String(c.conditionId),
          conditionDescription: c.conditionDescription,
        })),
      }
    : { conditionRequired: false, conditions: [] };

  _conditionCache.set(categoryId, { data: result, expiry: Date.now() + CONDITION_TTL_MS });
  return result;
}

// ── Seller store categories ───────────────────────────────────────────────────
// Calls GET /sell/account/v1/store_category_tree with the seller's OAuth token.
// Returns a flat list so the frontend can render a simple <select>.
// level=0 means top-level, level=1 means one level deep, etc.

function flattenStoreTree(node, level, result) {
  if (!node) return result;
  if (level > 0) {
    result.push({ categoryId: String(node.categoryId), name: node.name, level: level - 1 });
  }
  for (const child of node.subCategories || []) {
    flattenStoreTree(child, level + 1, result);
  }
  return result;
}

async function getStoreCategories() {
  if (_storeCategoriesCache && Date.now() < _storeCacheExpiry) {
    return _storeCategoriesCache;
  }

  const token = await getAccessToken();
  if (!token) throw new Error("Could not obtain eBay access token");

  const res = await fetch(`${ACCOUNT_BASE}/store_category_tree`, {
    headers: ebayHeaders(token),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getStoreCategoryTree failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  const categories = flattenStoreTree(data.rootCategory, 0, []);

  _storeCategoriesCache = categories;
  _storeCacheExpiry = Date.now() + STORE_CATEGORIES_TTL_MS;
  logger.info(`[eBay catalog] cached ${categories.length} seller store categories`);
  return categories;
}

module.exports = { getCategorySuggestions, getConditionPolicies, getStoreCategories };
