// controllers/product.controller.js

const {
  generateNextSku,
  generateVariantsForProduct,
  ensureInventoryForProduct,
  getProducts,
  findProductById,
  addProductNote,
  getProductBySlug,
  getPopulatedProduct,
  createProductRecordWithSlug,
  getVariantsByProduct,
  findVariant,
  getPopulatedVariant,
  hasMarketplaceListings,
  saveProduct,
  saveProductWithUniqueSlug,
  softDeleteProduct,
  saveVariant,
  applyStockEntries,
} = require("../services/product.service");
const vehicleModelService = require("../services/vehicle-model.service");
const { logger } = require("../loaders/logging");
const { generateSlug } = require("../utils/slug");
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

// Best-effort: adds this make/model/model_code/year combo to this tenant's
// OWN vehicle catalog (covers custom values typed into the vehicle
// Combobox) without letting a catalog write failure block the product save.
// Never writes to the shared/global catalog — see vehicle-model.service.js.
async function syncVehicleModelCatalog(vehicle, tenantId) {
  if (!vehicle) return;
  try {
    await vehicleModelService.upsertVehicleModel(vehicle, tenantId);
  } catch (err) {
    logger.warn(`[product.controller] failed to sync vehicle model catalog: ${err.message}`);
  }
}

exports.getProducts = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;

    const filter = buildProductFilter(req.query, { authenticated: !!req.user, tenantId: req.tenantId });

    const sort = PRODUCT_SORT_OPTIONS[req.query.sort] || PRODUCT_SORT_OPTIONS.newest;
    const stockFilter = req.query.stock || undefined;

    const { items, total } = await getProducts(filter, { skip, limit, sort, stockFilter });

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
        await applyStockEntries(product._id, parsedStockEntries);
      }
    }

    return created(res, await getPopulatedProduct(product._id, req.tenantId), "Product created");
  } catch (err) {
    if (err.code === 11000)
      return requestConflict(res, "Product slug already exists");
    return systemfailure(res, err);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await findProductById(req.params.id, req.tenantId);
    if (!product) return notFound(res, "Product not found");

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
    if (err.code === 11000)
      return requestConflict(res, "Product slug already exists");
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
    return success(res, null, "Product deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.duplicateProduct = async (req, res) => {
  try {
    const original = await findProductById(req.params.id);
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
