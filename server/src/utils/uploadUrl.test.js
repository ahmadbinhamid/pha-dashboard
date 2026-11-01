// utils/uploadUrl.test.js
// Upload refs: stored without a host, read back on today's UPLOADS_URL.

const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../config");
const { toUploadRef, toUploadUrl } = require("./uploadUrl");

const FILE = "09fd850d-615c-4e79-8fa9-b3f56588faee.png";

test("toUploadRef strips any host from our upload URLs only", () => {
  assert.equal(toUploadRef(`https://app.autopartspro.au/uploads/${FILE}`), FILE);
  assert.equal(toUploadRef(`http://localhost:7001/uploads/${FILE}?v=2`), FILE);
  assert.equal(toUploadRef(FILE), FILE);
  assert.equal(toUploadRef("https://cdn.example.com/uploads/banner.png"), "https://cdn.example.com/uploads/banner.png");
  assert.equal(toUploadRef(null), null);
  assert.equal(toUploadRef(""), "");
});

test("toUploadUrl builds from UPLOADS_URL, legacy hosts included", () => {
  const expected = `${config.uploads.url}/${FILE}`;
  assert.equal(toUploadUrl(FILE), expected);
  assert.equal(toUploadUrl(`https://app.autopartspro.au/uploads/${FILE}`), expected);
  assert.equal(toUploadUrl("https://cdn.example.com/hero.jpg"), "https://cdn.example.com/hero.jpg");
  assert.equal(toUploadUrl(null), null);
});
