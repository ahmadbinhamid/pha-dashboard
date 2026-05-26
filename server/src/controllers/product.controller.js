// controllers/product.controller.js

const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const {
  generateVariantsForProduct,
  ensureInventoryForProduct,
  syncProductToEbay,
  deleteProductFromEbay,
} = require("../services/product.service");
const { generateSlug, ensureUniqueSlug } = require("../utils/slug");
const {
  parseField,
  parseFormDataArrays,
  toBool,
} = require("../utils/formData");
const {
  PRODUCT_TYPE,
  PRODUCT_STATUS,
  EBAY_SYNC_STATUS,
} = require("../constants/product.constants");
const {
  success,
  created,
  notFound,
  badRequest,
  requestConflict,
  systemfailure,
} = require("../utils/http/response");

const withBasePopulate = (query) =>
  query
    .populate("attachments", "url original_name mime_type type uid file_name")
    .populate("categories", "name slug");

async function fetchPopulated(id) {
  return Product.findById(id)
    .populate("attachments")
    .populate("categories")
    .populate("digital_file");
}

exports.getProducts = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;

    const filter = {};

    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), "i");
      filter.$or = [{ title: re }, { sku: re }, { brand: re }, { tags: re }];
    }
    if (req.query.status !== undefined && req.query.status !== "") {
      filter.status = parseInt(req.query.status);
    }
    if (req.query.type !== undefined && req.query.type !== "") {
      filter.type = parseInt(req.query.type);
    }
    if (req.query.categories) {
      const cats = req.query.categories.split(",").filter(Boolean);
      if (cats.length) filter.categories = { $in: cats };
    }

    const [items, total] = await Promise.all([
      withBasePopulate(Product.find(filter))
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

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
    const product = await Product.findOne({ slug: req.params.slug })
      .populate("attachments")
      .populate("categories")
      .populate("digital_file")
      .populate("related_products", "title slug price attachments");

    if (!product) return notFound(res, "Product not found");
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
      is_vat_inclusive,
      vat_rate,
      sku,
      barcode,
      stock_control,
      has_variants,
      brand,
      digital_file,
    } = body;

    if (!title) return badRequest(res, "Title is required");

    const { attachments, categories, tags, related_products, choices } =
      parseFormDataArrays(body);

    const slug = await ensureUniqueSlug(Product, generateSlug(title));

    const product = await Product.create({
      title,
      slug,
      description: description || "",
      type: type !== undefined ? Number(type) : PRODUCT_TYPE.PHYSICAL,
      status: status !== undefined ? Number(status) : PRODUCT_STATUS.DRAFT,
      is_published_online: toBool(is_published_online),
      price: price !== undefined ? Number(price) : 0,
      compare_price: compare_price ? Number(compare_price) : null,
      cost_price: cost_price ? Number(cost_price) : null,
      is_taxable: toBool(is_taxable),
      is_vat_inclusive: toBool(is_vat_inclusive),
      vat_rate: vat_rate ? Number(vat_rate) : null,
      sku: sku || null,
      barcode: barcode || null,
      stock_control: toBool(stock_control),
      has_variants: toBool(has_variants),
      brand: brand || null,
      attachments,
      categories,
      tags,
      related_products,
      choices,
      digital_file: digital_file || null,
    });

    // Generate variants + ensure inventory
    if (product.has_variants && product.choices.length > 0) {
      const variants = await generateVariantsForProduct(product);
      if (product.stock_control) {
        for (const v of variants)
          await ensureInventoryForProduct(product._id, v._id);
      }
    } else if (product.stock_control) {
      await ensureInventoryForProduct(product._id, null);
    }

    // eBay sync (non-blocking)
    if (product.status === PRODUCT_STATUS.ACTIVE && product.is_published_online) {
      const variants = product.has_variants
        ? await ProductVariant.find({ product: product._id })
        : [];
      await syncProductToEbay(product, variants);
    }

    const populated = await fetchPopulated(product._id);
    return created(res, populated, "Product created");
  } catch (err) {
    if (err.code === 11000)
      return requestConflict(res, "Product slug already exists");
    return systemfailure(res, err);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
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
      is_vat_inclusive,
      vat_rate,
      sku,
      barcode,
      stock_control,
      has_variants,
      brand,
      digital_file,
    } = body;

    // Slug regeneration only when title actually changes
    if (title !== undefined && title !== product.title) {
      product.slug = await ensureUniqueSlug(
        Product,
        generateSlug(title),
        product._id.toString(),
      );
      product.title = title;
    }

    if (description !== undefined) product.description = description;
    if (type !== undefined) product.type = Number(type);
    if (status !== undefined) product.status = Number(status);
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
    if (is_vat_inclusive !== undefined)
      product.is_vat_inclusive = toBool(is_vat_inclusive);
    if (vat_rate !== undefined)
      product.vat_rate =
        vat_rate === "" || vat_rate === null ? null : Number(vat_rate);
    if (sku !== undefined) product.sku = sku || null;
    if (barcode !== undefined) product.barcode = barcode || null;
    if (stock_control !== undefined)
      product.stock_control = toBool(stock_control);
    if (has_variants !== undefined) product.has_variants = toBool(has_variants);
    if (brand !== undefined) product.brand = brand || null;
    if (digital_file !== undefined) product.digital_file = digital_file || null;

    // Parse array fields from FormData
    const { attachments, categories, tags, related_products, choices } =
      parseFormDataArrays(body);

    const bodyKeys = Object.keys(body);
    if (bodyKeys.includes("attachments")) product.attachments = attachments;
    if (bodyKeys.includes("categories")) product.categories = categories;
    if (bodyKeys.includes("tags")) product.tags = tags;
    if (bodyKeys.includes("related_products"))
      product.related_products = related_products;

    // Detect choices change and regenerate variants if needed
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

    // eBay sync (non-blocking)
    if (product.status === PRODUCT_STATUS.ACTIVE && product.is_published_online) {
      const variants = product.has_variants
        ? await ProductVariant.find({ product: product._id })
        : [];
      await syncProductToEbay(product, variants);
    }

    const populated = await fetchPopulated(product._id);
    return success(res, populated, "Product updated");
  } catch (err) {
    if (err.code === 11000)
      return requestConflict(res, "Product slug already exists");
    return systemfailure(res, err);
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return notFound(res, "Product not found");

    const sku = product.sku || `ph-${product._id}`;
    await product.softDelete();

    if (product.ebay_sync_status !== EBAY_SYNC_STATUS.NOT_LISTED) {
      await deleteProductFromEbay(sku);
    }

    return success(res, null, "Product deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.duplicateProduct = async (req, res) => {
  try {
    const original = await Product.findById(req.params.id);
    if (!original) return notFound(res, "Product not found");

    const slug = await ensureUniqueSlug(
      Product,
      generateSlug(`${original.title} copy`),
    );

    const clone = await Product.create({
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
      is_vat_inclusive: original.is_vat_inclusive,
      vat_rate: original.vat_rate,
      sku: null,
      barcode: null,
      stock_control: original.stock_control,
      has_variants: original.has_variants,
      brand: original.brand,
      attachments: original.attachments,
      categories: original.categories,
      tags: original.tags,
      choices: original.choices,
      digital_file: original.digital_file,
      ebay_sync_status: EBAY_SYNC_STATUS.NOT_LISTED,
    });

    if (clone.has_variants && clone.choices.length > 0) {
      await generateVariantsForProduct(clone);
    }

    const populated = await fetchPopulated(clone._id);
    return created(res, populated, "Product duplicated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getVariants = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return notFound(res, "Product not found");

    const variants = await ProductVariant.find({ product: product._id })
      .populate("attachments")
      .populate("digital_file")
      .sort({ display_name: 1 });

    return success(res, variants);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateVariant = async (req, res) => {
  try {
    const variant = await ProductVariant.findOne({
      _id: req.params.variantId,
      product: req.params.id,
    });
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

    const populated = await ProductVariant.findById(variant._id)
      .populate("attachments")
      .populate("digital_file");

    return success(res, populated, "Variant updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};
