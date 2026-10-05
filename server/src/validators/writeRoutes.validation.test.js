// validators/writeRoutes.validation.test.js
// FE-shaped payloads pass the new validators; bad ones get the 400 shape.

const test = require("node:test");
const { before, after, mock } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");

// Before app loads: product create must not queue real search jobs.
const searchQueue = require("../queues/search.queue");
mock.method(searchQueue, "enqueueSearchJob", async () => {});

const app = require("../app");
const { signJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Product = require("../models/Product");
const Location = require("../models/Location");
const MarketplaceListing = require("../models/MarketplaceListing");
const { seedSystemRoles } = require("../services/role.service");
const { addMember } = require("../services/membership.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");

const BAD_REQUEST = { status: "Fail", systemfailure: false, data: null };
const LONG = "x".repeat(5000);

let server;
let baseUrl;
let token;
let tenantId;

before(async () => {
  await mongoose.connect(config.mongoUri);
  tenantId = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: tenantId, name: `Validate ${suffix}`, slug: `validate-${suffix}`, code: `VA${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  const roles = await seedSystemRoles(tenantId);
  const { insertedId } = await User.collection.insertOne({
    tenant_id: tenantId, first_name: "Va", last_name: "Lidate", email: `validate-${suffix}@example.com`,
    password: "x".repeat(20), role: "user", status: "active", deleted_at: null,
  });
  await addMember({ tenantId, userId: insertedId, roleId: roles[SYSTEM_ROLE.ADMIN]._id });
  token = signJwt({ sub: String(insertedId), role: "user" });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
});
after(async () => {
  server.close();
  await mongoose.disconnect();
});

async function send(method, path, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(isForm ? {} : { "Content-Type": "application/json" }) },
    body: isForm ? body : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function assertRejected(method, path, body, pattern) {
  const res = await send(method, path, body);
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.deepEqual({ ...res.body, message: undefined }, { ...BAD_REQUEST, message: undefined });
  assert.match(res.body.message, pattern);
}

// Mirrors src/lib/api/listings.ts#formStateToPayload for a filled-in form.
function ebayListingPayload(productId) {
  return {
    product: String(productId), variant: null, title_override: "Toyota Hilux headlight", description_override: null,
    price_override: 129.5, ebay_category_id: "33710", store_category_id: null, store_sku: null, condition: null,
    condition_notes: "", item_specifics: { brand: "Toyota", mpn: "81110-0K010", superseded_part_number: ["81110-0K011"], authenticity: "Genuine", warranty: null },
    fitment: [{ make: "Toyota", model: "Hilux", model_code: "KUN26", year_from: 2005, year_to: 2015 }],
    format: "FIXED_PRICE", quantity_available: null, listing_duration: "GTC", accept_best_offer: false, min_best_offer: null,
    fulfillment_policy_id: null, payment_policy_id: null, return_policy_id: null, photo_overrides: [],
    require_immediate_payment: true, item_location_zip: null, package: { length: 40, width: 30, height: 20, weight: 2.5 },
  };
}

// Mirrors src/lib/products/productForm.ts#productFormToFormData in create mode.
function desktopProductForm(title = "Validated headlight") {
  const fd = new FormData();
  const fields = {
    title, description: "<p>Left side</p>", price: "129.50", compare_price: "150", shipping_cost: "12.5", is_taxable: "true",
    barcode: "", mpn: "81110-0K010", condition: "USED", authenticity: "Genuine",
    vehicle: JSON.stringify({ make: "Toyota", model: "Hilux", model_code: null, year_from: 2005, year_to: null }),
    additional_fitments: JSON.stringify([]), package: JSON.stringify({ length: 40, width: null, height: null, weight: 2 }),
    bay: "A1", shipping_method: "standard", tailgate_pickup: "false", tailgate_delivery: "false", type: "physical",
    status: "draft", is_published_online: "false", stock_control: "true", categories: JSON.stringify([]),
    tags: JSON.stringify(["headlight"]), attachments: JSON.stringify([]),
  };
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return fd;
}

test("PUT /ebay/settings: the settings form's payload passes; bad fields don't", async () => {
  const form = {
    marketplace_id: "EBAY_AU", merchant_location_key: "", fulfillment_policy_id: "", payment_policy_id: "", return_policy_id: "",
    warehouse_street: "1 Main St", warehouse_city: "Sydney", warehouse_state: "NSW", warehouse_postcode: "2000",
    warehouse_country: "AU", warehouse_phone: "", fallback_image_url: "",
  };
  const ok = await send("PUT", "/ebay/settings", form);
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.data.warehouse_city, "Sydney");

  await assertRejected("PUT", "/ebay/settings", { ...form, warehouse_street: LONG }, /warehouse_street/);
  await assertRejected("PUT", "/ebay/settings", { ...form, sandbox: "maybe" }, /sandbox/);
  await assertRejected("PUT", "/ebay/settings", { ...form, marketplace_id: "Australia" }, /marketplace_id/);
});

test("POST/PUT /ebay/listings: the listing form's payload passes; bad fields don't", async () => {
  const product = await Product.create({ tenant_id: tenantId, title: "Listing source", slug: `listing-${crypto.randomUUID()}`, sku: `LS-${crypto.randomUUID()}` });
  const payload = ebayListingPayload(product._id);

  const created = await send("POST", "/ebay/listings", payload);
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const listingId = created.body.data._id;
  const stored = await MarketplaceListing.findById(listingId).lean();
  assert.equal(stored.item_specifics.mpn, "81110-0K010", "nested fields survive validation");
  assert.equal(stored.fitment[0].model_code, "KUN26");
  assert.equal(stored.package.weight, 2.5);

  const updated = await send("PUT", `/ebay/listings/${listingId}`, { ...payload, title_override: "Updated title", price_override: 99 });
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  assert.equal(updated.body.data.title_override, "Updated title");

  await assertRejected("POST", "/ebay/listings", { ...payload, product: "not-an-id" }, /product/);
  await assertRejected("POST", "/ebay/listings", { ...payload, price_override: "cheap" }, /price_override/);
  await assertRejected("PUT", `/ebay/listings/${listingId}`, { ...payload, title_override: LONG }, /title_override/);
  await assertRejected("PUT", `/ebay/listings/${listingId}`, { ...payload, format: "RAFFLE" }, /format/);
  await assertRejected("PUT", `/ebay/listings/${listingId}`, { ...payload, fitment: [{ make: 7 }] }, /fitment/);
});

test("POST/PUT /location: a well-formed location passes; bad fields don't", async () => {
  const created = await send("POST", "/location", { name: "Back Shed", address: "2 Side St", is_active: true });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const locationId = created.body.data._id;

  const updated = await send("PUT", `/location/${locationId}`, { address: "3 Side St" });
  assert.equal(updated.status, 200);
  assert.equal((await Location.findById(locationId).lean()).address, "3 Side St");

  await assertRejected("POST", "/location", { address: "no name" }, /name/);
  await assertRejected("POST", "/location", { name: LONG }, /name/);
  await assertRejected("PUT", `/location/${locationId}`, { is_active: "sometimes" }, /is_active/);
  await assertRejected("PUT", "/location/not-an-id", { name: "x" }, /id/);
});

test("POST /product (multipart): desktop and mobile payloads pass; bad fields don't", async () => {
  const desktop = await send("POST", "/product", desktopProductForm());
  assert.equal(desktop.status, 201, JSON.stringify(desktop.body));
  const stored = await Product.findById(desktop.body.data._id).lean();
  assert.equal(stored.mpn, "81110-0K010", "mpn isn't stripped");
  assert.equal(stored.shipping_cost, 12.5, "shipping_cost isn't stripped");
  assert.equal(stored.price, 129.5);
  assert.equal(stored.is_taxable, true);
  assert.deepEqual(stored.tags, ["headlight"]);

  // Mobile omits additional_fitments and blank optionals.
  const mobile = desktopProductForm("Mobile headlight");
  mobile.delete("additional_fitments");
  mobile.delete("compare_price");
  mobile.delete("barcode");
  const fromMobile = await send("POST", "/product", mobile);
  assert.equal(fromMobile.status, 201, JSON.stringify(fromMobile.body));

  const withField = (key, value) => {
    const fd = desktopProductForm();
    fd.set(key, value);
    return fd;
  };
  await assertRejected("POST", "/product", withField("title", LONG), /title/);
  await assertRejected("POST", "/product", withField("title", "   "), /Title is required/);
  await assertRejected("POST", "/product", withField("price", "free"), /price/);
  await assertRejected("POST", "/product", withField("condition", "BROKEN"), /condition/);
  await assertRejected("POST", "/product", withField("tags", "not json"), /tags/);
  await assertRejected("POST", "/product", withField("is_taxable", "yes"), /is_taxable/);
});
