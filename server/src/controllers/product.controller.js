// controllers/product.controller.js

const {
  generateNextSku,
  generateVariantsForProduct,
  ensureInventoryForProduct,
  getProducts,
  getProductStats,
  getProductsByIds,
  getProductSuggestions,
  findProductById,
  addProductNote,
  sendProductInfoEmail,
  getProductBySlug,
  getPopulatedProduct,
  createProductRecordWithSlug,
  getVariantsByProduct,
  listVariantIdsForProduct,
  findVariant,
  getPopulatedVariant,
  hasMarketplaceListings,
  saveProduct,
  saveProductWithUniqueSlug,
  softDeleteProduct,
  saveVariant,
  applyStockEntries,
} = require("../services/product.service");
const searchService = require("../services/search/product.search.service");
const vehicleModelService = require("../services/vehicle-model.service");
const { fanOutMarketplaceInventory } = require("../services/inventory.service");
const { enqueueSearchJob } = require("../queues/search.queue");
const { logger } = require("../loaders/logging");
const { generateSlug } = require("../utils/slug");
const { duplicateKeyMessage } = require("../utils/duplicateKey");
const { buildProductFilter } = require("../utils/productFilter");
const {
  parseField,
  parseFormDataArrays,
  toBool,
} = require("../utils/formData");
const {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  PRODUCT_CONDITION,
  PRODUCT_SORT_OPTIONS,
} = require("../constants/product.constants");
const {
  success,
  created,
  notFound,
  badRequest,
  requestConflict,
  systemfailure,
} = require("../utils/http/response");

// Best-effort: adds this vehicle combo to the tenant's own catalog without blocking the product save on failure.
async function syncVehicleModelCatalog(vehicle, tenantId) {
  if (!vehicle) return;
  try {
    await vehicleModelService.upsertVehicleModel(vehicle, tenantId);
  } catch (err) {
    logger.warn(`[product.controller] failed to sync vehicle model catalog: ${err.message}`);
  }
}

// Fire-and-forget like above; the worker re-fetches the product itself, so only the id travels here.
async function syncSearchIndex(productId) {
  try {
    await enqueueSearchJob("index_product", { productId: productId.toString() });
  } catch (err) {
    logger.warn(`[product.controller] failed to enqueue search index job: ${err.message}`);
  }
}

async function removeFromSearchIndex(productId) {
  try {
    await enqueueSearchJob("delete_product", { productId: productId.toString() });
  } catch (err) {
    logger.warn(`[product.controller] failed to enqueue search delete job: ${err.message}`);
  }
}

// Marketplace fan-out on product/variant edits: without this, a plain price/title/photo edit could silently
// drift eBay/Google listings from the Product for up to 25 days. Fields below mirror what listing.resolver.js
// reads off Product for a channel payload (title covers slug, since slug only changes via title here).
const MARKETPLACE_RELEVANT_PRODUCT_FIELDS = ["title", "description", "price", "brand", "mpn", "condition"];

function snapshotMarketplaceProductFields(product) {
  const snap = {};
  for (const field of MARKETPLACE_RELEVANT_PRODUCT_FIELDS) snap[field] = product[field];
  snap.attachments = (product.attachments || []).map((a) => a.toString());
  return snap;
}

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

function marketplaceProductFieldsChanged(before, after) {
  for (const field of MARKETPLACE_RELEVANT_PRODUCT_FIELDS) {
    if (before[field] !== after[field]) return true;
  }
  return !arraysEqual(before.attachments, after.attachments);
}

// Variant counterpart: only price/sku/photo overrides matter here, since title/description/brand/mpn always come from the parent Product.
const MARKETPLACE_RELEVANT_VARIANT_FIELDS = ["price", "sku"];

function snapshotMarketplaceVariantFields(variant) {
  const snap = {};
  for (const field of MARKETPLACE_RELEVANT_VARIANT_FIELDS) snap[field] = variant[field];
  snap.attachments = (variant.attachments || []).map((a) => a.toString());
  return snap;
}

function marketplaceVariantFieldsChanged(before, after) {
  for (const field of MARKETPLACE_RELEVANT_VARIANT_FIELDS) {
    if (before[field] !== after[field]) return true;
  }
  return !arraysEqual(before.attachments, after.attachments);
}

// Best-effort single fan-out call; a queue/DB hiccup never fails the update response.
async function bestEffortFanOut(productId, variantId, tenantId) {
  try {
    await fanOutMarketplaceInventory(productId, variantId, tenantId);
  } catch (err) {
    logger.warn(
      `[product.controller] failed to fan out marketplace sync for product ${productId}` +
        `${variantId ? ` variant ${variantId}` : ""}: ${err.message}`,
    );
  }
}

// A product-level change can affect every variant's listings too, so this fans out to base listings and all variants.
async function fanOutProductChangeToListings(productId, tenantId) {
  await bestEffortFanOut(productId, null, tenantId);
  try {
    const variantIds = await listVariantIdsForProduct(productId, tenantId);
    for (const variantId of variantIds) {
      await bestEffortFanOut(productId, variantId, tenantId);
    }
  } catch (err) {
    logger.warn(`[product.controller] failed to enumerate variants for marketplace fan-out on product ${productId}: ${err.message}`);
  }
}

// In-memory equivalent of a Mongo sort spec, applied to already-hydrated search results (Typesense only ranks by relevance).
function sortByFields(items, sortSpec) {
  const entries = Object.entries(sortSpec);
  return [...items].sort((a, b) => {
    for (const [field, dir] of entries) {
      if (a[field] < b[field]) return -1 * dir;
      if (a[field] > b[field]) return 1 * dir;
    }
    return 0;
  });
}

// Caps how many Typesense hits get hydrated/stock-filtered in JS per search page; revisit if a catalog outgrows this.
const SEARCH_CANDIDATE_LIMIT = 250;

exports.getProducts = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;
    const stockFilter = req.query.stock || undefined;
    const channelFilter = req.query.channel || undefined;

    if (req.query.search) {
      const categories = req.query.categories
        ? (Array.isArray(req.query.categories) ? req.query.categories : req.query.categories.split(","))
            .map((c) => c.trim())
            .filter(Boolean)
        : [];

      const { ids } = await searchService.searchProducts({
        q: req.query.search,
        tenantId: req.tenantId,
        publishedOnly: !req.user,
        categories,
        condition: req.query.condition || undefined,
        authenticity: req.query.authenticity || undefined,
        priceMin: req.query.price_min,
        priceMax: req.query.price_max,
        make: req.query.make || undefined,
        model: req.query.model || undefined,
        page: 1,
        perPage: SEARCH_CANDIDATE_LIMIT,
      });

      const { items } = await getProductsByIds(ids, { stockFilter, channelFilter });

      // Only override Typesense's default relevance order if the caller asked for a sort.
      const sortSpec = req.query.sort ? PRODUCT_SORT_OPTIONS[req.query.sort] : null;
      const ordered = sortSpec ? sortByFields(items, sortSpec) : items;

      const total = ordered.length;
      return success(res, {
        items: ordered.slice(skip, skip + limit),
        total,
        page,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      });
    }

    const filter = buildProductFilter(req.query, { authenticated: !!req.user, tenantId: req.tenantId });
    const sort = PRODUCT_SORT_OPTIONS[req.query.sort] || PRODUCT_SORT_OPTIONS.newest;

    const { items, total } = await getProducts(filter, { skip, limit, sort, stockFilter, channelFilter });

    return success(res, {
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getProductStats = async (req, res) => {
  try {
    const stats = await getProductStats(req.tenantId);
    return success(res, stats);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.suggestProducts = async (req, res) => {
  try {
    const { ids, total } = await searchService.suggestProducts({
      tenantId: req.tenantId,
      q: req.query.q,
      limit: req.query.limit,
    });
    const items = await getProductSuggestions(ids);
    return success(res, { items, total });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await getProductBySlug(req.params.slug, req.tenantId);
    if (!product) return notFound(res, "Product not found");
    // Unauthenticated callers can't see unpublished/draft products by slug either
    if (
      !req.user &&
      (!product.is_published_online || product.status !== PRODUCT_STATUS.ACTIVE)
    ) {
      return notFound(res, "Product not found");
    }
    return success(res, product);
  } catch (err) {
    return systemfailure(res, err);
  }
};

// createProduct/duplicateProduct deliberately skip marketplace fan-out: a new product never has listings yet, so it'd be a no-op.
exports.createProduct = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      title,
      description,
      type,
      status,
      is_published_online,
      price,
      compare_price,
      cost_price,
      is_taxable,
      sku,
      barcode,
      stock_control,
      has_variants,
      brand,
      mpn,
      condition,
      authenticity,
      digital_file,
      stock_entries,
      vehicle,
      shipping_cost,
    } = body;

    if (!title) return badRequest(res, "Title is required");

    const { attachments, categories, tags, related_products, choices } =
      parseFormDataArrays(body);
    const parsedVehicle = parseField(vehicle, null);

    const autoSku = await generateNextSku(req.tenant);

    const product = await createProductRecordWithSlug({
      title,
      description: description || "",
      type: type !== undefined ? type : PRODUCT_TYPE.PHYSICAL,
      status: status !== undefined ? status : PRODUCT_STATUS.DRAFT,
      is_published_online: toBool(is_published_online),
      price: price !== undefined ? Number(price) : 0,
      compare_price: compare_price ? Number(compare_price) : null,
      cost_price: cost_price ? Number(cost_price) : null,
      shipping_cost: shipping_cost ? Number(shipping_cost) : null,
      is_taxable: toBool(is_taxable),
      sku: autoSku,
      barcode: barcode || null,
      stock_control: toBool(stock_control),
      has_variants: toBool(has_variants),
      brand: brand || null,
      mpn: mpn || null,
      condition: condition || PRODUCT_CONDITION.NEW,
      authenticity: authenticity || null,
      vehicle: parsedVehicle,
      attachments,
      categories,
      tags,
      related_products,
      choices,
      digital_file: digital_file || null,
    }, generateSlug(title), req.tenantId);

    await syncVehicleModelCatalog(parsedVehicle, req.tenantId);
    await syncSearchIndex(product._id);

    const parsedStockEntries = stock_entries
      ? JSON.parse(stock_entries)
      : [];

    if (product.has_variants && product.choices.length > 0) {
      const variants = await generateVariantsForProduct(product);
      if (product.stock_control) {
        for (const v of variants)
          await ensureInventoryForProduct(product._id, v._id, req.tenantId);
      }
    } else if (product.stock_control) {
      await ensureInventoryForProduct(product._id, null, req.tenantId);
      if (parsedStockEntries.length > 0) {
        await applyStockEntries(product._id, parsedStockEntries, {
          tenantId: req.tenantId,
          userId: req.user?._id,
        });
      }
    }

    return created(res, await getPopulatedProduct(product._id, req.tenantId), "Product created");
  } catch (err) {
    // Names the index that actually rejected the write, since slug and sku are both unique here.
    const conflict = duplicateKeyMessage(err, "Product", { slug: "slug", sku: "SKU" });
    if (conflict) return requestConflict(res, conflict);
    return systemfailure(res, err);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await findProductById(req.params.id, req.tenantId);
    if (!product) return notFound(res, "Product not found");

    // Snapshot before mutation, compared post-save to decide if this edit needs to reach eBay/Google.
    const beforeMarketplaceFields = snapshotMarketplaceProductFields(product);

    const body = req.body || {};
    const {
      title,
      description,
      type,
      status,
      is_published_online,
      price,
      compare_price,
      cost_price,
      is_taxable,
      sku,
      barcode,
      stock_control,
      has_variants,
      brand,
      mpn,
      condition,
      authenticity,
      digital_file,
      vehicle,
      shipping_cost,
    } = body;

    let pendingSlugBase = null;
    if (title !== undefined && title !== product.title) {
      pendingSlugBase = generateSlug(title);
      product.title = title;
    }

    if (description !== undefined) product.description = description;
    if (type !== undefined) product.type = type;
    if (status !== undefined) product.status = status;
    if (is_published_online !== undefined)
      product.is_published_online = toBool(is_published_online);
    if (price !== undefined) product.price = Number(price);
    if (compare_price !== undefined)
      product.compare_price =
        compare_price === "" || compare_price === null
          ? null
          : Number(compare_price);
    if (cost_price !== undefined)
      product.cost_price =
        cost_price === "" || cost_price === null ? null : Number(cost_price);
    if (shipping_cost !== undefined)
      product.shipping_cost =
        shipping_cost === "" || shipping_cost === null ? null : Number(shipping_cost);
    if (is_taxable !== undefined) product.is_taxable = toBool(is_taxable);
    if (sku !== undefined) product.sku = sku || null;
    if (barcode !== undefined) product.barcode = barcode || null;
    if (stock_control !== undefined)
      product.stock_control = toBool(stock_control);
    if (has_variants !== undefined) product.has_variants = toBool(has_variants);
    if (brand !== undefined) product.brand = brand || null;
    if (mpn !== undefined) product.mpn = mpn || null;
    if (condition !== undefined) product.condition = condition || PRODUCT_CONDITION.NEW;
    if (authenticity !== undefined) product.authenticity = authenticity || null;
    if (digital_file !== undefined) product.digital_file = digital_file || null;
    if (vehicle !== undefined) product.vehicle = parseField(vehicle, null);

    const { attachments, categories, tags, related_products, choices } =
      parseFormDataArrays(body);

    const bodyKeys = Object.keys(body);
    if (bodyKeys.includes("attachments")) product.attachments = attachments;
    if (bodyKeys.includes("categories")) product.categories = categories;
    if (bodyKeys.includes("tags")) product.tags = tags;
    if (bodyKeys.includes("related_products"))
      product.related_products = related_products;

    const choicesChanged =
      bodyKeys.includes("choices") &&
      JSON.stringify(choices) !==
        JSON.stringify(product.choices.map((c) => c.toObject()));

    if (bodyKeys.includes("choices")) product.choices = choices;

    if (pendingSlugBase) {
      await saveProductWithUniqueSlug(product, pendingSlugBase);
    } else {
      await saveProduct(product);
    }

    if (vehicle !== undefined) await syncVehicleModelCatalog(product.vehicle, req.tenantId);
    await syncSearchIndex(product._id);

    // Only fan out if a field a channel payload actually reads changed — skip notes/categories/tags-only edits.
    if (marketplaceProductFieldsChanged(beforeMarketplaceFields, snapshotMarketplaceProductFields(product))) {
      await fanOutProductChangeToListings(product._id, req.tenantId);
    }

    if (choicesChanged && product.has_variants && product.choices.length > 0) {
      const newVariants = await generateVariantsForProduct(product);
      if (product.stock_control) {
        for (const v of newVariants)
          await ensureInventoryForProduct(product._id, v._id, req.tenantId);
      }
    }

    if (product.stock_control && !product.has_variants) {
      await ensureInventoryForProduct(product._id, null, req.tenantId);
    }

    return success(res, await getPopulatedProduct(product._id, req.tenantId), "Product updated");
  } catch (err) {
    const conflict = duplicateKeyMessage(err, "Product", { slug: "slug", sku: "SKU" });
    if (conflict) return requestConflict(res, conflict);
    return systemfailure(res, err);
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await findProductById(req.params.id, req.tenantId);
    if (!product) return notFound(res, "Product not found");

    const hasListing = await hasMarketplaceListings(product._id);
    if (hasListing) {
      return requestConflict(res, "Cannot delete a product that has a marketplace listing. Remove the listing first.");
    }

    await softDeleteProduct(product);
    await removeFromSearchIndex(product._id);
    return success(res, null, "Product deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.duplicateProduct = async (req, res) => {
  try {
    const original = await findProductById(req.params.id, req.tenantId);
    if (!original) return notFound(res, "Product not found");

    const clone = await createProductRecordWithSlug({
      title: `${original.title} (Copy)`,
      description: original.description,
      type: original.type,
      status: PRODUCT_STATUS.DRAFT,
      is_published_online: false,
      price: original.price,
      compare_price: original.compare_price,
      cost_price: original.cost_price,
      shipping_cost: original.shipping_cost,
      is_taxable: original.is_taxable,
      sku: null,
      barcode: null,
      stock_control: original.stock_control,
      has_variants: original.has_variants,
      brand: original.brand,
      mpn: original.mpn,
      condition: original.condition,
      authenticity: original.authenticity,
      vehicle: original.vehicle,
      attachments: original.attachments,
      categories: original.categories,
      tags: original.tags,
      choices: original.choices,
      digital_file: original.digital_file,
    }, generateSlug(`${original.title} copy`), req.tenantId);

    if (clone.has_variants && clone.choices.length > 0) {
      await generateVariantsForProduct(clone);
    }

    await syncSearchIndex(clone._id);

    return created(res, await getPopulatedProduct(clone._id, req.tenantId), "Product duplicated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getVariants = async (req, res) => {
  try {
    const product = await findProductById(req.params.id, req.tenantId);
    if (!product) return notFound(res, "Product not found");

    const variants = await getVariantsByProduct(product._id, req.tenantId);
    return success(res, variants);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateVariant = async (req, res) => {
  try {
    const variant = await findVariant(req.params.variantId, req.params.id, req.tenantId);
    if (!variant) return notFound(res, "Variant not found");

    // Same before/after snapshot as updateProduct, scoped to fields this variant can override.
    const beforeMarketplaceFields = snapshotMarketplaceVariantFields(variant);

    const body = req.body || {};
    const {
      price,
      compare_price,
      cost_price,
      sku,
      barcode,
      is_active,
      digital_file,
    } = body;

    if (price !== undefined) variant.price = Number(price);
    if (compare_price !== undefined)
      variant.compare_price =
        compare_price === "" || compare_price === null
          ? null
          : Number(compare_price);
    if (cost_price !== undefined)
      variant.cost_price =
        cost_price === "" || cost_price === null ? null : Number(cost_price);
    if (sku !== undefined) variant.sku = sku || null;
    if (barcode !== undefined) variant.barcode = barcode || null;
    if (is_active !== undefined) variant.is_active = toBool(is_active);
    if (digital_file !== undefined) variant.digital_file = digital_file || null;

    if (body.attachments !== undefined) {
      variant.attachments = parseField(body.attachments);
    }

    await saveVariant(variant);

    // Fan out only to this variant's own listings; a variant change never affects a sibling's listing.
    if (marketplaceVariantFieldsChanged(beforeMarketplaceFields, snapshotMarketplaceVariantFields(variant))) {
      await bestEffortFanOut(variant.product, variant._id, req.tenantId);
    }

    return success(res, await getPopulatedVariant(variant._id, req.tenantId), "Variant updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.addProductNote = async (req, res) => {
  try {
    const product = await addProductNote(
      req.params.id,
      { text: req.body.text, userId: req.user?._id },
      req.tenantId,
    );
    if (!product) return notFound(res, "Product not found");
    return created(res, product, "Note added");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.sendProductEmail = async (req, res) => {
  try {
    const product = await sendProductInfoEmail(
      req.params.id,
      { name: req.body.name, email: req.body.email },
      req.tenantId,
    );
    if (!product) return notFound(res, "Product not found");
    return success(res, product, "Email sent");
  } catch (err) {
    return systemfailure(res, err);
  }
};
