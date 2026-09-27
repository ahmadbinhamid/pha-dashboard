// services/shipping/transdirect.api.service.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const { errorDetail, toQuotes, quoteShipment } = require("./transdirect.api.service");
const { toAuStateCode, isAuState } = require("../../utils/auState");

test("errorDetail: flattens Transdirect's nested field errors", () => {
  assert.equal(errorDetail({ errors: { sender: { state: ["Invalid State"] } } }), "sender state: Invalid State");
  assert.equal(errorDetail({ message: "Bad key" }), "Bad key");
  assert.equal(errorDetail(null), "");
});

test("toAuStateCode: full names and any case map to the code", () => {
  assert.equal(toAuStateCode("VICTORIA"), "VIC");
  assert.equal(toAuStateCode(" new south wales "), "NSW");
  assert.equal(toAuStateCode("qld"), "QLD");
  assert.equal(toAuStateCode(null), "");
  assert.equal(isAuState("Victoria"), true);
  assert.equal(isAuState("Narnia"), false);
});

test("toQuotes: reads a courier list as well as a map", () => {
  const quotes = toQuotes([{ courier: "toll", total: "20" }, { courier: "tnt", total: 0 }]);
  assert.deepEqual(quotes.map((q) => q.courier), ["toll"]);
  assert.deepEqual(toQuotes([]), []);
});

test("quoteShipment: sends the documented v4 quote body", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => ({ ok: true, status: 201, json: async () => ({ quotes: { tnt: { total: 20 } } }) }));
  try {
    await quoteShipment("k", {
      declaredValue: 500,
      requestingSite: "https://www.partshubaustralia.com.au/",
      items: [{ weight: 5, height: 20, width: 30, length: 40, quantity: 1 }],
      sender: { postcode: "2000", suburb: "SYDNEY", state: "NSW", type: "business" },
      receiver: { postcode: "3000", suburb: "MELBOURNE", state: "VIC", type: "residential" },
    });
    const body = JSON.parse(fetchMock.mock.calls[0].arguments[1].body);
    assert.deepEqual(body, {
      declared_value: 500,
      referrer: "api",
      requesting_site: "https://www.partshubaustralia.com.au/",
      tailgate_pickup: false,
      tailgate_delivery: false,
      items: [{ weight: 5, height: 20, width: 30, length: 40, quantity: 1, description: "Parcel" }],
      sender: { postcode: "2000", suburb: "SYDNEY", state: "NSW", type: "business", country: "AU" },
      receiver: { postcode: "3000", suburb: "MELBOURNE", state: "VIC", type: "residential", country: "AU" },
    });
  } finally {
    fetchMock.mock.restore();
  }
});

test("requestingSite: the store's domain, else the configured storefront URL", () => {
  const config = require("../../config");
  const { requestingSite } = require("./shippingSettings.service");
  assert.equal(requestingSite("shop.example.test"), "https://shop.example.test/");
  assert.equal(requestingSite(null), config.emailBrand.storefrontUrl);
  assert.ok(requestingSite(null), "never undefined, or Transdirect gets no requesting_site");
});
