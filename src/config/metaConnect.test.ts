import test from "node:test";
import assert from "node:assert/strict";
import { metaApiErrorMessage, metaConnectErrorMessage } from "./metaConnect.ts";

const apiError = (message: string, reason?: string) => Object.assign(new Error(message), { reason });

test("a known reason gets its friendly copy", () => {
  assert.match(metaApiErrorMessage(apiError("raw", "no_catalog_granted")), /select your catalog/);
});

test("an unknown error shows the server's message, not a generic one", () => {
  const message = "Meta owned_product_catalogs failed: 400 (code 200) Requires business_management";
  assert.equal(metaApiErrorMessage(apiError(message)), message);
});

test("callback copy keeps the generic fallback with the raw reason", () => {
  assert.equal(metaConnectErrorMessage("exchange_failed"), "Failed to connect Meta (exchange_failed). Please try again.");
  assert.match(metaConnectErrorMessage("state_expired"), /took too long/);
});
