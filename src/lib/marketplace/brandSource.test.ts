import test from "node:test";
import assert from "node:assert/strict";
import { resolveChannelBrand } from "./brandSource.ts";

test("product brand wins over the store default", () => {
  assert.deepEqual(resolveChannelBrand({ productBrand: "Bosch", defaultBrand: "Parts Hub", usesDefault: true }), { brand: "Bosch", source: "product" });
});

test("brandless product uses the store default on channels that read it", () => {
  assert.deepEqual(resolveChannelBrand({ productBrand: "", defaultBrand: " Parts Hub ", usesDefault: true }), { brand: "Parts Hub", source: "store_default" });
});

test("a channel that ignores the default (eBay) shows no brand", () => {
  assert.deepEqual(resolveChannelBrand({ productBrand: null, defaultBrand: "Parts Hub", usesDefault: false }), { brand: null, source: null });
});

test("a listing override is labelled as such", () => {
  assert.deepEqual(resolveChannelBrand({ listingBrand: "ACDelco", productBrand: "Bosch", usesDefault: true }), { brand: "ACDelco", source: "listing" });
});
