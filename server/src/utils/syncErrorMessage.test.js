// utils/syncErrorMessage.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const { readableSyncError } = require("./syncErrorMessage");

test("eBay JSON errors become their message", () => {
  const raw =
    'upsert inventory_item failed: 400 {"errors":[{"errorId":25004,"message":"The quantity must be a valid number greater than 0."}]}';
  assert.equal(readableSyncError(raw), "The quantity must be a valid number greater than 0.");
});

test("longMessage wins, and duplicates collapse", () => {
  const body = { errors: [{ message: "short", longMessage: "Full detail." }, { message: "Full detail." }] };
  assert.equal(readableSyncError(`create offer failed: 400 ${JSON.stringify(body)}`), "Full detail.");
});

test("Google's JSON error and non-JSON bodies", () => {
  assert.equal(readableSyncError('insert product failed: 403 {"error":{"message":"Access denied."}}'), "Access denied.");
  assert.equal(readableSyncError("publish_offer failed: 502 <html>Bad gateway</html>"), "publish offer failed (HTTP 502).");
});

test("the long storefront-domain paragraph becomes one line", () => {
  const raw = "No verified default domain for tenant 6a8d — Google Shopping requires a real ... Settings > Domains.";
  assert.match(readableSyncError(raw), /^Google Shopping needs a verified storefront domain/);
});

test("plain text and empty values pass through", () => {
  assert.equal(readableSyncError("Platform not connected"), "Platform not connected");
  assert.equal(readableSyncError(null), null);
});

test("eBay's opaque system error gets an actionable hint", () => {
  const raw = 'upsert inventory_item failed: 500 {"errors":[{"errorId":25001,"message":"A system error has occurred. Internal Server Error"}]}';
  assert.match(readableSyncError(raw), /^eBay couldn't process this item\. Check its package size/);
});
