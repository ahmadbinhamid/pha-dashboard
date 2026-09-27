// services/ebay/ebay.catalog.service.js
// eBay Taxonomy (category suggestions, app-level token) and Sell Metadata (condition policies, seller token).

const { getAccessToken, getCatalogToken, ebayHeaders, apiBaseUrlFor } = require("./ebay.api.service");
const { logger } = require("../../loaders/logging");

const TAXONOMY_BASE = `${apiBaseUrlFor(false)}/commerce/taxonomy/v1`;

// Unlike TAXONOMY_BASE (always production), condition policies use the tenant's own environment-specific
// seller token, so this must be computed per-call — hardcoding production would silently break sandbox tenants.
function metadataBaseFor(sandbox) {
  return `${apiBaseUrlFor(sandbox)}/sell/metadata/v1`;
}

// ── In-memory caches ──────────────────────────────────────────────────────────

let _treeId = null;

const _conditionCache = new Map();
const CONDITION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Category tree ID (cached indefinitely — eBay tree IDs are very stable) ────

async function getCategoryTreeId(token, marketplaceId) {
  if (_treeId) return _treeId;

  const res = await fetch(
    `${TAXONOMY_BASE}/get_default_category_tree_id?marketplace_id=${marketplaceId}`,
    { headers: ebayHeaders(token, marketplaceId) },
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
// eBay's getCategorySuggestions doesn't work in sandbox; return a { sandbox: true } sentinel instead.

async function getCategorySuggestions(q, settings) {
  if (settings?.sandbox) {
    return { sandbox: true, suggestions: [] };
  }

  const marketplaceId = settings?.marketplace_id || "EBAY_AU";
  const token = await getCatalogToken();
  if (!token) throw new Error("Could not obtain eBay catalog token");

  const treeId = await getCategoryTreeId(token, marketplaceId);
  const url = `${TAXONOMY_BASE}/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(q)}`;

  const res = await fetch(url, { headers: ebayHeaders(token, marketplaceId) });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`getCategorySuggestions failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  const suggestions = (data.categorySuggestions || []).map((s) => {
    // Ancestors arrive in arbitrary order; sort ascending by tree level.
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
// Sell Metadata returns numeric conditionIds; Sell Inventory expects the string enum — remap here.

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
// Filters to a single categoryId so we never download the full tree.

async function getConditionPolicies(categoryId, settings) {
  // Cache key must be unique per (tenant, environment, marketplace); an unconnected tenant
  // has no tenant_id and would collapse onto a shared key, so skip caching for that case.
  const canCache = settings?.tenant_id != null;
  const cacheKey = canCache
    ? `${settings.tenant_id}:${!!settings.sandbox}:${settings.marketplace_id}:${categoryId}`
    : null;

  if (canCache) {
    const cached = _conditionCache.get(cacheKey);
    if (cached && Date.now() < cached.expiry) return cached.data;
  }

  const token = await getAccessToken(settings);
  if (!token) throw new Error("Could not obtain eBay access token");

  const marketplaceId = settings.marketplace_id;
  // filter=categoryIds:{id} selects exactly this one category
  const filter = `categoryIds:{${categoryId}}`;
  const url = `${metadataBaseFor(settings.sandbox)}/marketplace/${marketplaceId}/get_item_condition_policies?filter=${encodeURIComponent(filter)}`;

  const res = await fetch(url, { headers: ebayHeaders(token, marketplaceId) });

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
          // conditionId is the ConditionEnum string, not the raw numeric id.
          conditionId: CONDITION_ID_TO_ENUM[Number(c.conditionId)] || String(c.conditionId),
          conditionDescription: c.conditionDescription,
        })),
      }
    : { conditionRequired: false, conditions: [] };

  if (canCache) {
    _conditionCache.set(cacheKey, { data: result, expiry: Date.now() + CONDITION_TTL_MS });
  }
  return result;
}

module.exports = { getCategorySuggestions, getConditionPolicies };
