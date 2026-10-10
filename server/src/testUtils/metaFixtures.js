// testUtils/metaFixtures.js
// Meta test fixtures: tenant, storefront, product, photos and a stubbed Graph.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { mock } = require("node:test");
const config = require("../config");
const { fixtureId } = require("./fixtureTenants");

require("../models/index");
const Product = require("../models/Product");
const ProductVariant = require("../models/ProductVariant");
const Attachment = require("../models/Attachment");
const Location = require("../models/Location");
const Inventory = require("../models/Inventory");
const Domain = require("../models/Domain");
const MarketplaceListing = require("../models/MarketplaceListing");
const ChannelConnection = require("../models/ChannelConnection");
const { encrypt, packCiphertext } = require("../utils/crypto/tokenCipher");

const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), "meta-fixtures-"));

/** Points uploads at a temp dir over https and sets fake Meta app creds. */
function useMetaTestConfig() {
  const saved = { url: config.uploads.url, dir: config.uploads.dir, meta: { ...config.meta } };
  config.uploads.url = "https://cdn.example.com/uploads";
  config.uploads.dir = uploadsDir;
  Object.assign(config.meta, { appId: "app-1", appSecret: "secret-1", redirectUri: "https://api.example.com/cb", loginConfigId: "cfg-1" });
  return () => {
    config.uploads.url = saved.url;
    config.uploads.dir = saved.dir;
    Object.assign(config.meta, saved.meta);
  };
}

// Only the PNG signature and IHDR size; enough for readImageSize.
function writePng(fileName, width, height) {
  const buf = Buffer.alloc(24);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(0x0d0a1a0a, 4);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12, "latin1");
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  fs.writeFileSync(path.join(uploadsDir, fileName), buf);
}

async function makePhoto(tenantId, { width = 800, height = 800 } = {}) {
  const fileName = `meta-${crypto.randomUUID()}.png`;
  writePng(fileName, width, height);
  return Attachment.create({ tenant_id: tenantId, uid: crypto.randomUUID(), file_name: fileName, mime_type: "image/png" });
}

/** Connected Meta tenant with a verified storefront domain. */
async function makeMetaTenant({ connection = {} } = {}) {
  const suffix = crypto.randomUUID();
  const tenantId = fixtureId();
  await Domain.create({
    tenant_id: tenantId, hostname: `meta-${suffix}.example.com`, status: "active", is_default: true, verification_token: suffix,
  });
  const location = await Location.create({ tenant_id: tenantId, name: `Loc ${suffix}` });
  await ChannelConnection.collection.insertOne({
    tenant_id: tenantId, platform: "meta", status: "connected", consecutive_failures: 0, status_reason: null,
    last_error: null, deleted_at: null, access_token_ct: packCiphertext(encrypt(`token-${suffix}`)),
    token_expires_at: null, business_id: "111", catalog_id: "222", ...connection,
  });
  return { tenantId, locationId: location._id, suffix };
}

/** Product + meta listing; `photo` false for none, or { width, height }. */
async function makeMetaListing(tenant, opts = {}) {
  const { stock = 4, stockControl = true, photo = {}, brand = "Bosch", listing = {}, categories = [], variant = false } = opts;
  const suffix = crypto.randomUUID();
  const attachments = photo ? [(await makePhoto(tenant.tenantId, photo))._id] : [];
  const product = await Product.create({
    tenant_id: tenant.tenantId, title: `Meta part ${suffix}`, slug: `meta-part-${suffix}`, sku: `MP-${suffix}`,
    status: "active", stock_control: stockControl, brand, condition: "NEW", price: 12.5, attachments, categories,
  });
  const variantDoc = variant
    ? await ProductVariant.create({ tenant_id: tenant.tenantId, product: product._id, sku: `MPV-${suffix}`, price: 15, display_name: "Left" })
    : null;
  await Inventory.create({ product: product._id, variant: variantDoc?._id ?? null, location: tenant.locationId, stock_count: stock });
  const doc = await MarketplaceListing.create({
    tenant_id: tenant.tenantId, product: product._id, variant: variantDoc?._id ?? null, platform: "meta", state: "active",
    meta_product_category: "8526", push_seq: 1, ...listing,
  });
  return { product, variant: variantDoc, listing: doc, sku: variantDoc ? variantDoc.sku : product.sku };
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

/** Stubs Graph fetch; handlers return [status, json]; calls are recorded. */
function stubGraph({ itemsBatch, checkStatus } = {}) {
  const calls = { itemsBatch: [], checkStatus: [], other: [] };
  mock.method(global, "fetch", async (url, opts) => {
    const u = String(url);
    if (u.includes("/items_batch")) {
      const body = Object.fromEntries(new URLSearchParams(opts.body));
      const requests = JSON.parse(body.requests);
      calls.itemsBatch.push({ url: u, body, requests });
      const [status, json] = itemsBatch ? itemsBatch(requests, body) : [200, { handles: [`h-${calls.itemsBatch.length}`], validation_status: [] }];
      return jsonResponse(status, json);
    }
    if (u.includes("/check_batch_request_status")) {
      const params = new URL(u).searchParams;
      calls.checkStatus.push({ url: u, handle: params.get("handle") });
      const [status, json] = checkStatus ? checkStatus(params.get("handle")) : [200, { data: [{ status: "finished", errors_total_count: 0 }] }];
      return jsonResponse(status, json);
    }
    calls.other.push(u);
    return jsonResponse(404, { error: { message: "unhandled", code: 100 } });
  });
  return calls;
}

module.exports = { useMetaTestConfig, makeMetaTenant, makeMetaListing, makePhoto, stubGraph, jsonResponse, uploadsDir };
