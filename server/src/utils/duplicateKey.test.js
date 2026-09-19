// utils/duplicateKey.test.js
//
// Guards the mapping that turned a live prod incident into a wild goose
// chase: a duplicate SKU was reported to the user as "Product slug already
// exists", because the controller mapped every E11000 to a slug message.
// No DB needed — these are the error shapes Mongo actually hands back.

const test = require("node:test");
const assert = require("node:assert/strict");
const { duplicateKeyField, duplicateKeyMessage } = require("./duplicateKey");

const LABELS = { slug: "slug", sku: "SKU" };

const dupKeyError = (keyPattern, keyValue) =>
  Object.assign(new Error("E11000 duplicate key error collection"), {
    code: 11000,
    keyPattern,
    keyValue,
  });

test("a sku collision is reported as a sku collision, not a slug one", () => {
  const err = dupKeyError({ tenant_id: 1, sku: 1 }, { tenant_id: "t1", sku: "PHA-000539" });
  assert.equal(duplicateKeyField(err), "sku");
  assert.equal(
    duplicateKeyMessage(err, "Product", LABELS),
    'Product SKU "PHA-000539" already exists',
  );
});

test("a slug collision still names the slug", () => {
  const err = dupKeyError({ tenant_id: 1, slug: 1 }, { tenant_id: "t1", slug: "demo-product" });
  assert.equal(
    duplicateKeyMessage(err, "Product", LABELS),
    'Product slug "demo-product" already exists',
  );
});

test("the tenant scope is never reported as the colliding field", () => {
  // Every unique index here leads with tenant_id, so naive Object.keys()[0]
  // would blame the tenant on every single conflict.
  const err = dupKeyError({ tenant_id: 1, sku: 1 }, { tenant_id: "t1", sku: "PHA-000001" });
  assert.notEqual(duplicateKeyField(err), "tenant_id");
});

test("non-duplicate errors return null so callers fall through to systemfailure", () => {
  assert.equal(duplicateKeyMessage(new Error("boom"), "Product", LABELS), null);
  assert.equal(duplicateKeyMessage({ code: 121 }, "Product", LABELS), null);
  assert.equal(duplicateKeyMessage(null, "Product", LABELS), null);
});

test("an unlabelled or valueless key still produces a usable message", () => {
  const err = dupKeyError({ tenant_id: 1, barcode: 1 }, { tenant_id: "t1", barcode: "X1" });
  assert.equal(duplicateKeyMessage(err, "Product", LABELS), 'Product barcode "X1" already exists');

  const noValue = Object.assign(new Error("E11000"), { code: 11000, keyPattern: { sku: 1 } });
  assert.equal(duplicateKeyMessage(noValue, "Product", LABELS), "Product SKU already exists");
});
