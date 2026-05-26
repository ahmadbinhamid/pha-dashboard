// services/product.service.js

const ProductVariant = require("../models/ProductVariant");
const Inventory = require("../models/Inventory");
const Location = require("../models/Location");
const { enqueueEbayJob } = require("../queues/ebay.queue");

function cartesian(arrays) {
  if (!arrays || arrays.length === 0) return [[]];
  return arrays.reduce(
    (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
    [[]],
  );
}

async function generateVariantsForProduct(product) {
  if (!product.choices || product.choices.length === 0) return [];

  const optionNames = product.choices.map((c) => c.name);
  const optionValues = product.choices.map((c) => c.items || []);

  const combinations = cartesian(optionValues);
  const existingVariants = await ProductVariant.find({ product: product._id });
  const newVariants = [];

  for (const combo of combinations) {
    const combination = optionNames.map((name, i) => ({
      option: name,
      value: combo[i] || "",
    }));

    const display_name = combo.join(" / ");

    const alreadyExists = existingVariants.find((v) => {
      if (v.combination.length !== combination.length) return false;
      return v.combination.every(
        (c, i) =>
          c.option === combination[i].option &&
          c.value === combination[i].value,
      );
    });

    if (!alreadyExists) {
      const variant = await ProductVariant.create({
        product: product._id,
        combination,
        display_name,
        price: product.price || 0,
        compare_price: product.compare_price || null,
        cost_price: product.cost_price || null,
      });
      newVariants.push(variant);
    }
  }

  return newVariants;
}

async function ensureInventoryForProduct(productId, variantId = null) {
  const locations = await Location.find({ is_active: true });
  if (!locations.length) return;

  for (const loc of locations) {
    await Inventory.findOneAndUpdate(
      { product: productId, variant: variantId, location: loc._id },
      {
        $setOnInsert: {
          product: productId,
          variant: variantId,
          location: loc._id,
        },
      },
      { upsert: true, new: true },
    );
  }
}

async function syncProductToEbay(product, variants = []) {
  try {
    await enqueueEbayJob("sync_product", {
      product: product.toObject ? product.toObject() : product,
      variants: variants.map((v) => (v.toObject ? v.toObject() : v)),
    });
  } catch (qErr) {
    console.warn("[product.service] eBay queue unavailable:", qErr.message);
  }
}

async function deleteProductFromEbay(sku) {
  try {
    await enqueueEbayJob("delete_product", { sku });
  } catch (qErr) {
    console.warn("[product.service] eBay queue unavailable:", qErr.message);
  }
}

module.exports = {
  cartesian,
  generateVariantsForProduct,
  ensureInventoryForProduct,
  syncProductToEbay,
  deleteProductFromEbay,
};
