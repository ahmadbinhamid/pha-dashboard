// services/shipping/shippingSettings.service.js
// Tenant Transdirect setup; the only code that decrypts the stored API key.

const ShippingSettings = require("../../models/ShippingSettings");
const { encrypt, decrypt, packCiphertext, unpackCiphertext } = require("../../utils/crypto/tokenCipher");
const { httpError } = require("../../utils/http/httpError");
const { locationsForPostcode } = require("./transdirect.api.service");

const SENDER_FIELDS = ["sender_postcode", "sender_suburb", "sender_state", "sender_type"];

async function findSettings(tenantId) {
  return ShippingSettings.findOne({ tenant_id: tenantId }).select("+transdirect_api_key_ct").lean();
}

// Never exposes the key, only whether one is saved.
function toPublic(doc) {
  return {
    transdirect_configured: !!doc?.transdirect_api_key_ct,
    ...Object.fromEntries(SENDER_FIELDS.map((f) => [f, doc?.[f] ?? null])),
  };
}

async function getSettings(tenantId) {
  return toPublic(await findSettings(tenantId));
}

/** Saves sender details; a blank api_key keeps the saved one. */
async function updateSettings(tenantId, { api_key, ...sender }) {
  const $set = Object.fromEntries(SENDER_FIELDS.filter((f) => sender[f] !== undefined).map((f) => [f, sender[f] || null]));
  if (api_key) $set.transdirect_api_key_ct = packCiphertext(encrypt(api_key.trim()));
  const doc = await ShippingSettings.findOneAndUpdate(
    { tenant_id: tenantId },
    { $set, $setOnInsert: { tenant_id: tenantId } },
    { upsert: true, new: true, runValidators: true },
  ).select("+transdirect_api_key_ct").lean();
  return toPublic(doc);
}

/** Decrypted key plus ship-from address, or null if either is missing. */
async function getTransdirectConfig(tenantId) {
  const doc = await findSettings(tenantId);
  const apiKey = doc?.transdirect_api_key_ct ? decrypt(unpackCiphertext(doc.transdirect_api_key_ct)) : null;
  if (!apiKey || !doc.sender_postcode || !doc.sender_suburb) return null;
  return {
    apiKey,
    sender: { postcode: doc.sender_postcode, suburb: doc.sender_suburb, state: doc.sender_state ?? "", type: doc.sender_type },
  };
}

/** Checks the key works and the ship-from suburb matches its postcode. */
async function testConnection(tenantId) {
  const config = await getTransdirectConfig(tenantId);
  if (!config) throw httpError("Save an API key and ship-from postcode and suburb first", 422);
  const locations = await locationsForPostcode(config.apiKey, config.sender.postcode);
  const match = locations.some((l) => l.suburb.toUpperCase() === config.sender.suburb.toUpperCase());
  if (!match) {
    const known = locations.slice(0, 5).map((l) => l.suburb).join(", ");
    throw httpError(`"${config.sender.suburb}" isn't in postcode ${config.sender.postcode}${known ? ` (try ${known})` : ""}`, 422);
  }
  return { ok: true };
}

module.exports = { getSettings, updateSettings, getTransdirectConfig, testConnection };
