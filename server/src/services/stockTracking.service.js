// services/stockTracking.service.js
// Turns stock tracking back on for products saved with it off.

const Product = require("../models/Product");
const MarketplaceListing = require("../models/MarketplaceListing");
const { getTotalStockForProducts, fanOutMarketplaceInventory } = require("./inventory.service");

// The app always tracks stock now; an old "off" hides stock from eBay/Google.
async function findUntrackedProducts(tenantId = null) {
  return Product.find({ stock_control: false, ...(tenantId ? { tenant_id: tenantId } : {}) })
    .select("_id sku title tenant_id")
    .lean();
}

// Per product: stock on hand and which channels it's listed on.
async function describe(products) {
  const ids = products.map((p) => p._id);
  const [stock, listings] = await Promise.all([
    getTotalStockForProducts(ids),
    MarketplaceListing.find({ product: { $in: ids } }).select("product platform").lean(),
  ]);
  const channelsByProduct = new Map();
  for (const l of listings) {
    const key = String(l.product);
    channelsByProduct.set(key, [...(channelsByProduct.get(key) ?? []), l.platform]);
  }
  return products.map((p) => ({
    ...p,
    stock: stock.get(String(p._id)) ?? 0,
    channels: channelsByProduct.get(String(p._id)) ?? [],
  }));
}

/** Dry run unless confirm; then flips the flag and resyncs listed products. */
async function enableStockTracking({ tenantId = null, confirm = false } = {}) {
  const products = await describe(await findUntrackedProducts(tenantId));
  if (!confirm || !products.length) return { confirmed: false, products };

  await Product.updateMany({ _id: { $in: products.map((p) => p._id) } }, { $set: { stock_control: true } });
  // Each listing pushes its real quantity; one failure won't stop the rest.
  for (const p of products.filter((x) => x.channels.length)) {
    await fanOutMarketplaceInventory(p._id, null, p.tenant_id).catch(() => null);
  }
  return { confirmed: true, products };
}

module.exports = { enableStockTracking };
