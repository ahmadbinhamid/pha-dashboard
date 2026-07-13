// controllers/product.controller.js

const {
  generateNextSku,
  generateVariantsForProduct,
  ensureInventoryForProduct,
  ensureUniqueProductSlug,
  getProducts,
  findProductById,
  getProductBySlug,
  getPopulatedProduct,
  createProductRecord,
  getVariantsByProduct,
  findVariant,
  getPopulatedVariant,
  hasMarketplaceListings,
} = require("../services/product.service");
const { generateSlug } = require("../utils/slug");
const {
  parseField,
  parseFormDataArrays,
  toBool,
} = require("../utils/formData");
const {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  PRODUCT_CONDITION,
} = require("../constants/product.constants");
const {
  success,
  created,
  notFound,
  badRequest,
  requestConflict,
  systemfailure,
} = require("../utils/http/response");

exports.getProducts = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;

    const filter = {};

    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), "i");
      filter.$or = [{ title: re }, { sku: re }, { brand: re }, { tags: re }];
    }
    if (!req.user) {
      // Unauthenticated (public/storefront) callers only ever see published, active products
      filter.is_published_online = true;
      filter.status = PRODUCT_STATUS.ACTIVE;
    } else if (req.query.status !== undefined && req.query.status !== "") {
      filter.status = req.query.status;
    }
    if (req.query.type !== undefined && req.query.type !== "") {
      filter.type = req.query.type;
    }
    if (req.query.categories) {
      const cats = req.query.categories.split(",").filter(Boolean);
      if (cats.length) filter.categories = { $in: cats };
    }

    const { items, total } = await getProducts(filter, { skip, limit });

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
    const product = await getProductBySlug(req.params.slug);
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
      condition,
      authenticity,
      digital_file,
      stock_entries,
      vehicle,
    } = body;

    if (!title) return badRequest(res, "Title is required");

    const { attachments, categories, tags, related_products, choices } =
      parseFormDataArrays(body);
    const parsedVehicle = parseField(vehicle, null);

    const slug = await ensureUniqueProductSlug(generateSlug(title));
    const autoSku = await generateNextSku();

    const product = await createProductRecord({
      title,
      slug,
      description: description || "",
      type: type !== undefined ? type : PRODUCT_TYPE.PHYSICAL,
      status: status !== undefined ? status : PRODUCT_STATUS.DRAFT,
      is_published_online: toBool(is_published_online),
      price: price !== undefined ? Number(price) : 0,
      compare_price: compare_price ? Number(compare_price) : null,
      cost_price: cost_price ? Number(cost_price) : null,
      is_taxable: toBool(is_taxable),
      sku: autoSku,
      barcode: barcode || null,
      stock_control: toBool(stock_control),
      has_variants: toBool(has_variants),
      brand: brand || null,
      condition: condition || PRODUCT_CONDITION.NEW,
      authenticity: authenticity || null,
      vehicle: parsedVehicle,
      attachments,
      categories,
      tags,
      related_products,
      choices,
      digital_file: digital_file || null,
    });

    const parsedStockEntries = stock_entries
      ? JSON.parse(stock_entries)
      : [];

    if (product.has_variants && product.choices.length > 0) {
      const variants = await generateVariantsForProduct(product);
      if (product.stock_control) {
        for (const v of variants)
          await ensureInventoryForProduct(product._id, v._id);
      }
    } else if (product.stock_control) {
      await ensureInventoryForProduct(product._id, null);
      if (parsedStockEntries.length > 0) {
        const Inventory = require("../models/Inventory");
        for (const entry of parsedStockEntries) {
          if (entry.qty > 0) {
            await Inventory.updateOne(
              { product: product._id, variant: null, location: entry.location_id },
              { $set: { stock_count: entry.qty } },
            );
          }
        }
      }
    }

    return created(res, await getPopulatedProduct(product._id), "Product created");
  } catch (err) {
    if (err.code === 11000)
      return requestConflict(res, "Product slug already exists");
    return systemfailure(res, err);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await findProductById(req.params.id);
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
      condition,
      authenticity,
      digital_file,
      vehicle,
    } = body;

    if (title !== undefined && title !== product.title) {
      product.slug = await ensureUniqueProductSlug(
        generateSlug(title),
        product._id.toString(),
      );
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
    if (is_taxable !== undefined) product.is_taxable = toBool(is_taxable);
    if (sku !== undefined) product.sku = sku || null;
    if (barcode !== undefined) product.barcode = barcode || null;
    if (stock_control !== undefined)
      product.stock_control = toBool(stock_control);
    if (has_variants !== undefined) product.has_variants = toBool(has_variants);
    if (brand !== undefined) product.brand = brand || null;
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

    await product.save();

    if (choicesChanged && product.has_variants && product.choices.length > 0) {
      const newVariants = await generateVariantsForProduct(product);
      if (product.stock_control) {
        for (const v of newVariants)
          await ensureInventoryForProduct(product._id, v._id);
      }
    }

    if (product.stock_control && !product.has_variants) {
      await ensureInventoryForProduct(product._id, null);
    }

    return success(res, await getPopulatedProduct(product._id), "Product updated");
  } catch (err) {
    if (err.code === 11000)
      return requestConflict(res, "Product slug already exists");
    return systemfailure(res, err);
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) return notFound(res, "Product not found");

    const hasListing = await hasMarketplaceListings(product._id);
    if (hasListing) {
      return requestConflict(res, "Cannot delete a product that has a marketplace listing. Remove the listing first.");
    }

    await product.softDelete();
    return success(res, null, "Product deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.duplicateProduct = async (req, res) => {
  try {
    const original = await findProductById(req.params.id);
    if (!original) return notFound(res, "Product not found");

    const slug = await ensureUniqueProductSlug(
      generateSlug(`${original.title} copy`),
    );

    const clone = await createProductRecord({
      title: `${original.title} (Copy)`,
      slug,
      description: original.description,
      type: original.type,
      status: PRODUCT_STATUS.DRAFT,
      is_published_online: false,
      price: original.price,
      compare_price: original.compare_price,
      cost_price: original.cost_price,
      is_taxable: original.is_taxable,
      sku: null,
      barcode: null,
      stock_control: original.stock_control,
      has_variants: original.has_variants,
      brand: original.brand,
      condition: original.condition,
      authenticity: original.authenticity,
      vehicle: original.vehicle,
      attachments: original.attachments,
      categories: original.categories,
      tags: original.tags,
      choices: original.choices,
      digital_file: original.digital_file,
    });

    if (clone.has_variants && clone.choices.length > 0) {
      await generateVariantsForProduct(clone);
    }

    return created(res, await getPopulatedProduct(clone._id), "Product duplicated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getVariants = async (req, res) => {
  try {
    const product = await findProductById(req.params.id);
    if (!product) return notFound(res, "Product not found");

    const variants = await getVariantsByProduct(product._id);
    return success(res, variants);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateVariant = async (req, res) => {
  try {
    const variant = await findVariant(req.params.variantId, req.params.id);
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

    await variant.save();

    return success(res, await getPopulatedVariant(variant._id), "Variant updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};
