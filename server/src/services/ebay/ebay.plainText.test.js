// services/ebay/ebay.plainText.test.js
// The inventory item's plain description never carries template CSS or code.

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildInventoryItemFromResolved } = require("./ebay.api.service");

const resolvedWith = (description) => ({
  sku: "PT-1",
  title: "Tail light",
  description,
  photos: [{ type: "image", url: "https://example.test/a.jpg" }],
  listing: { item_specifics: {} },
  product: {},
  condition: "NEW",
});

test("style, script and head contents are dropped, visible text kept", () => {
  const html =
    "<html><head><title>x</title><style>.pha-wrap{font-family:Georgia}</style></head>" +
    "<body><div class=\"pha-wrap\"><h1>Tail light</h1><p>Genuine &amp; tested</p><script>track()</script></div></body></html>";
  const { description } = buildInventoryItemFromResolved(resolvedWith(html), 1, "NEW", null).product;
  assert.equal(description, "Tail light Genuine & tested");
});

test("plain text passes through and falls back to the title", () => {
  assert.equal(buildInventoryItemFromResolved(resolvedWith("Just text"), 1, "NEW", null).product.description, "Just text");
  assert.equal(buildInventoryItemFromResolved(resolvedWith(""), 1, "NEW", null).product.description, "Tail light");
});

test("numeric entities and nbsp decode to real characters", () => {
  const html = "<p>&#9733;&#x2605;&nbsp;98% positive</p>";
  assert.equal(buildInventoryItemFromResolved(resolvedWith(html), 1, "NEW", null).product.description, "★★ 98% positive");
});
