// services/categoryMapping.service.js
// Tenant category -> channel category defaults (models/CategoryMapping.js). A listing's
// category resolves: per-listing value -> this mapping (first product category that has
// one) -> unset. Only platforms whose adapter declares `categoryField` take part.

const CategoryMapping = require("../models/CategoryMapping");
const Product = require("../models/Product");
const registry = require("./marketplace/registry");
const { listCategoryOptions, getCategoryById } = require("./category.service");
const {
  GOOGLE_AUTO_PARTS_CATEGORIES,
  GOOGLE_DEFAULT_PARTS_CATEGORY_ID,
} = require("../constants/googleProductCategory.constants");
const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

function httpError(message, status) {
  return Object.assign(new Error(message), { status });
}

/** Registered platforms that support category mapping. */
function mappablePlatforms() {
  return registry
    .getAll()
    .filter((adapter) => adapter.categoryField)
    .map((adapter) => ({ key: adapter.key, name: adapter.manifest?.name || adapter.key }));
}

function assertMappablePlatform(platform) {
  if (!mappablePlatforms().some((p) => p.key === platform)) {
    throw httpError(`Category mapping is not supported for platform: ${platform}`, 404);
  }
}

const KEYWORD_PATTERNS = GOOGLE_AUTO_PARTS_CATEGORIES.map((category) => ({
  category,
  patterns: category.keywords.map((kw) => new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`, "i")),
}));

/** Best-guess Google category for a tenant category name — a suggestion, never auto-applied. */
function suggestGoogleCategory(name) {
  const match = KEYWORD_PATTERNS.find(({ patterns }) => patterns.some((re) => re.test(name || "")));
  const category = match?.category || GOOGLE_AUTO_PARTS_CATEGORIES.find((c) => c.id === GOOGLE_DEFAULT_PARTS_CATEGORY_ID);
  return { id: category.id, name: category.name, matched: !!match };
}

/** Everything the mapping settings page needs, in one round trip. */
async function getMappingOverview(tenantId) {
  const [categories, mappings] = await Promise.all([
    listCategoryOptions(tenantId),
    CategoryMapping.find({ tenant_id: tenantId }).lean(),
  ]);
  return {
    platforms: mappablePlatforms(),
    categories: categories.map((c) => ({
      _id: c._id,
      name: c.name,
      parent: c.parent,
      suggestions: { [MARKETPLACE_PLATFORM.GOOGLE]: suggestGoogleCategory(c.name) },
    })),
    mappings,
    google_categories: GOOGLE_AUTO_PARTS_CATEGORIES.map(({ id, name }) => ({ id, name })),
  };
}

async function upsertMapping(tenantId, productCategoryId, platform, { external_category_id, external_category_name = null }) {
  assertMappablePlatform(platform);
  if (!(await getCategoryById(productCategoryId, tenantId))) throw httpError("Category not found", 404);

  return CategoryMapping.findOneAndUpdate(
    { tenant_id: tenantId, product_category_id: productCategoryId, platform },
    { $set: { external_category_id, external_category_name } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();
}

async function deleteMapping(tenantId, productCategoryId, platform) {
  assertMappablePlatform(platform);
  const { deletedCount } = await CategoryMapping.deleteOne({ tenant_id: tenantId, product_category_id: productCategoryId, platform });
  return deletedCount > 0;
}

// One query for every category id across a batch; callers pick per product.
async function findMappingsByCategory(tenantId, platform, categoryIds) {
  if (!categoryIds.length) return new Map();
  const rows = await CategoryMapping.find({ tenant_id: tenantId, platform, product_category_id: { $in: categoryIds } }).lean();
  return new Map(rows.map((row) => [String(row.product_category_id), row]));
}

// NOTE: a product can have several categories; the first one (in the product's own order)
// that has a mapping wins, so reordering categories is how a tenant picks between them.
function pickMapping(productCategoryIds, mappingsByCategory) {
  for (const id of productCategoryIds || []) {
    const row = mappingsByCategory.get(String(id?._id ?? id));
    if (row) return row;
  }
  return null;
}

function toResolvedCategory(row) {
  return row
    ? { id: row.external_category_id, name: row.external_category_name, source: "mapping", product_category_id: row.product_category_id }
    : null;
}

/** Category defaults for each product in a batch: Map(productId -> resolved category|null). */
async function resolveMappedCategories(tenantId, platform, products) {
  const categoryIds = [...new Set(products.flatMap((p) => (p.categories || []).map((c) => String(c?._id ?? c))))];
  const mappings = await findMappingsByCategory(tenantId, platform, categoryIds);
  return new Map(products.map((p) => [String(p._id), toResolvedCategory(pickMapping(p.categories, mappings))]));
}

/** Listing value if set, else the product's mapped default for `platform`, else null. */
async function resolveEffectiveCategoryId(tenantId, platform, listingValue, product) {
  if (listingValue) return listingValue;
  if (!product) return null;
  return (await resolveMappedCategories(tenantId, platform, [product])).get(String(product._id))?.id || null;
}

/** Per-platform category default for one product, for the product form's channel panels. */
async function getMappedCategoriesForProduct(tenantId, productId) {
  const product = await Product.findOne({ _id: productId, tenant_id: tenantId }).select("categories").lean();
  if (!product) return null;
  const entries = await Promise.all(
    mappablePlatforms().map(async ({ key }) => [key, (await resolveMappedCategories(tenantId, key, [product])).get(String(product._id))]),
  );
  return Object.fromEntries(entries);
}

module.exports = {
  getMappingOverview,
  upsertMapping,
  deleteMapping,
  resolveMappedCategories,
  resolveEffectiveCategoryId,
  getMappedCategoriesForProduct,
  suggestGoogleCategory,
  mappablePlatforms,
};
