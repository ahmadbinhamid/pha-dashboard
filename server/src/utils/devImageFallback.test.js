// utils/devImageFallback.test.js
// One dev placeholder for eBay sandbox, Meta and Google; never real listings.

const test = require("node:test");
const { afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const config = require("../config");
const { logger } = require("../loaders/logging");
const { DEV_FALLBACK_IMAGE } = require("../constants/channel.constants");
const { META_MIN_IMAGE_PX } = require("../constants/meta.constants");
const metaAdapter = require("../services/marketplace/adapters/meta.adapter");
const googleAdapter = require("../services/marketplace/adapters/google.adapter");
const { buildInventoryItemFromResolved } = require("../services/ebay/ebay.api.service");

const LOCAL = "http://localhost:5000/uploads/pad.jpg";
const REAL = "https://cdn.example.com/pad.jpg";
const GOOGLE_SETTINGS = { content_language: "en", feed_label: "AU", target_country: "AU" };

const saved = { flag: config.channels.devImageFallback, env: config.env, url: config.channels.devFallbackImageUrl };
afterEach(() => {
  config.channels.devImageFallback = saved.flag;
  config.env = saved.env;
  config.channels.devFallbackImageUrl = saved.url;
  mock.restoreAll();
});

function setup({ flag, env = "development", url = "" }) {
  config.channels.devImageFallback = flag;
  config.env = env;
  config.channels.devFallbackImageUrl = url;
  return { warn: mock.method(logger, "warn", () => {}), error: mock.method(logger, "error", () => {}) };
}

// Local photo's real size is tiny, so only the declared fallback size passes.
function resolvedWith(url) {
  return {
    sku: "SKU-DEV",
    title: "Brake pad",
    description: "Front pads",
    price: 12.5,
    brand: "Bosch",
    condition: "NEW",
    photos: [{ url }],
    photoSizes: [{ width: 100, height: 100 }],
    identifiers: { gtin: null, mpn: "MPN-1", brand: "Bosch" },
    category: { id: "8526", source: "mapping" },
    listing: { meta_product_category: null, google_product_category: "8526" },
    product: { _id: "p1", stock_control: true },
    variant: null,
    stock: { stock_control: true, quantity: 3 },
    productUrl: "https://store.example.com/product/brake-pad",
  };
}

const metaImage = (url) => metaAdapter.buildItemData(resolvedWith(url), 1, "https://store.example.com/p").image_link;
const googleImage = (url) =>
  googleAdapter.buildProductInputFromResolved(resolvedWith(url), GOOGLE_SETTINGS, 1, {}, "https://store.example.com/p").productAttributes
    .imageLink;

test("constant: public HTTPS and at least Meta's minimum size", () => {
  assert.ok(new URL(DEV_FALLBACK_IMAGE.url).protocol === "https:");
  assert.ok(DEV_FALLBACK_IMAGE.width >= META_MIN_IMAGE_PX && DEV_FALLBACK_IMAGE.height >= META_MIN_IMAGE_PX);
});

test("flag on + non-production + localhost image: fallback used, warning names the SKU", () => {
  const { warn } = setup({ flag: true });
  assert.equal(metaImage(LOCAL), DEV_FALLBACK_IMAGE.url);
  assert.equal(googleImage(LOCAL), DEV_FALLBACK_IMAGE.url);
  const messages = warn.mock.calls.map((c) => c.arguments[0]);
  assert.equal(messages.filter((m) => /SKU-DEV.*dev fallback image/.test(m)).length, 2, "one warning per adapter");
  assert.ok(messages.some((m) => m.startsWith("[MetaAdapter]")) && messages.some((m) => m.startsWith("[GoogleAdapter]")));
});

test("flag on + production: still rejected, with an error logged", () => {
  const { error } = setup({ flag: true, env: "production" });
  assert.throws(() => metaImage(LOCAL), /primary image is not a public HTTPS URL/);
  assert.throws(() => googleImage(LOCAL), /primary image is not a usable public HTTPS URL/);
  assert.equal(error.mock.calls.filter((c) => /ignored in production/.test(c.arguments[0])).length, 2);
});

test("flag off: rejected exactly as before, no fallback warning", () => {
  const { warn } = setup({ flag: false });
  assert.throws(() => metaImage(LOCAL), /primary image is not a public HTTPS URL/);
  assert.throws(() => googleImage(LOCAL), /primary image is not a usable public HTTPS URL/);
  assert.equal(warn.mock.calls.length, 0);
});

test("a real HTTPS image is never replaced, flag on or off", () => {
  for (const flag of [true, false]) {
    const { warn } = setup({ flag });
    const resolved = resolvedWith(REAL);
    resolved.photoSizes = [{ width: 800, height: 800 }];
    assert.equal(metaAdapter.buildItemData(resolved, 1, "https://store.example.com/p").image_link, REAL);
    assert.equal(googleImage(REAL), REAL);
    assert.equal(warn.mock.calls.length, 0);
    mock.restoreAll();
  }
});

test("a product with no image is still rejected with the fallback on", () => {
  setup({ flag: true });
  const resolved = { ...resolvedWith(LOCAL), photos: [], photoSizes: [] };
  assert.throws(() => metaAdapter.buildItemData(resolved, 1, "https://store.example.com/p"), /product has no images/);
});

const CUSTOM = "https://images.example.com/placeholder.jpg";

test(".env image: used by Meta and Google; Meta trusts its size", () => {
  setup({ flag: true, url: CUSTOM });
  assert.equal(metaImage(LOCAL), CUSTOM);
  assert.equal(googleImage(LOCAL), CUSTOM);
});

test(".env image that is not HTTPS: logged and ignored, item still rejected", () => {
  const { error } = setup({ flag: true, url: "http://localhost/p.png" });
  assert.throws(() => metaImage(LOCAL), /primary image is not a public HTTPS URL/);
  assert.throws(() => googleImage(LOCAL), /primary image is not a usable public HTTPS URL/);
  assert.ok(error.mock.calls.some((c) => /CHANNEL_DEV_FALLBACK_IMAGE_URL is not public HTTPS/.test(c.arguments[0])));
});

// eBay photos are attachments; a localhost UPLOADS_URL makes them http://.
const ebayResolved = (url) => ({
  ...resolvedWith(url),
  photos: url ? [{ type: "image", url }] : [],
  listing: { item_specifics: {} },
});
const ebayImages = (url, settings) => buildInventoryItemFromResolved(ebayResolved(url), 1, null, settings).product.imageUrls;

test("eBay sandbox: the shared placeholder replaces non-HTTPS or missing images", () => {
  setup({ flag: false });
  assert.deepEqual(ebayImages(LOCAL, { sandbox: true }), [DEV_FALLBACK_IMAGE.url], "no CHANNEL_DEV_IMAGE_FALLBACK needed");
  assert.deepEqual(ebayImages(null, { sandbox: true }), [DEV_FALLBACK_IMAGE.url], "unchanged: sandbox fills a missing image");
  config.channels.devFallbackImageUrl = CUSTOM;
  assert.deepEqual(ebayImages(LOCAL, { sandbox: true }), [CUSTOM]);
});

test("eBay live (not sandbox): never a placeholder, even with the flag on", () => {
  setup({ flag: true, url: CUSTOM });
  assert.deepEqual(ebayImages(LOCAL, { sandbox: false }), []);
  assert.deepEqual(ebayImages(LOCAL, null), []);
});

test("eBay: real HTTPS images are always sent as-is", () => {
  setup({ flag: true, url: CUSTOM });
  assert.deepEqual(ebayImages(REAL, { sandbox: true }), [REAL]);
  assert.deepEqual(ebayImages(REAL, { sandbox: false }), [REAL]);
});
