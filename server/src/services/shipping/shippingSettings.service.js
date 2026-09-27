// services/shipping/shippingSettings.service.js
// Tenant Transdirect setup; the only code that decrypts the stored API key.

const ShippingSettings = require("../../models/ShippingSettings");
const { encrypt, decrypt, packCiphertext, unpackCiphertext } = require("../../utils/crypto/tokenCipher");
const { httpError } = require("../../utils/http/httpError");
const { locationsForPostcode, quoteShipment } = require("./transdirect.api.service");
const { toAuStateCode } = require("../../utils/auState");
const { getDefaultStorefrontHost } = require("../domain.service");
const { ADDRESS_TYPE } = require("../../constants/shipping.constants");
const config = require("../../config");

const SENDER_FIELDS = ["sender_postcode", "sender_suburb", "sender_state", "sender_type"];

async function findSettings(tenantId) {
  return ShippingSettings.findOne({ tenant_id: tenantId }).select("+transdirect_api_key_ct").lean();
}

// Never exposes the key, only whether one is saved.
function toPublic(doc) {
  return {
    transdirect_configured: !!doc?.transdirect_api_key_ct,
    ...Object.fromEntries(SENDER_FIELDS.map((f) => [f, doc?.[f] ?? null])),
    // Older saves may hold a full name like "VICTORIA".
    sender_state: doc?.sender_state ? toAuStateCode(doc.sender_state) : null,
  };
}

async function getSettings(tenantId) {
  return toPublic(await findSettings(tenantId));
}

/** Saves sender details; a blank api_key keeps the saved one. */
async function updateSettings(tenantId, { api_key, ...sender }) {
  const $set = Object.fromEntries(SENDER_FIELDS.filter((f) => sender[f] !== undefined).map((f) => [f, sender[f] || null]));
  if ($set.sender_state) $set.sender_state = toAuStateCode($set.sender_state);
  if (api_key) $set.transdirect_api_key_ct = packCiphertext(encrypt(api_key.trim()));
  const doc = await ShippingSettings.findOneAndUpdate(
    { tenant_id: tenantId },
    { $set, $setOnInsert: { tenant_id: tenantId } },
    { upsert: true, new: true, runValidators: true },
  ).select("+transdirect_api_key_ct").lean();
  return toPublic(doc);
}

// The store's own website, else the platform-wide STOREFRONT_URL.
function requestingSite(host) {
  return host ? `https://${host}/` : config.emailBrand.storefrontUrl;
}

/** Decrypted key plus ship-from address, or null if either is missing. */
async function getTransdirectConfig(tenantId) {
  const [doc, host] = await Promise.all([findSettings(tenantId), getDefaultStorefrontHost(tenantId)]);
  const apiKey = doc?.transdirect_api_key_ct ? decrypt(unpackCiphertext(doc.transdirect_api_key_ct)) : null;
  if (!apiKey || !doc.sender_postcode || !doc.sender_suburb) return null;
  return {
    apiKey,
    sender: {
      postcode: doc.sender_postcode,
      suburb: doc.sender_suburb,
      state: toAuStateCode(doc.sender_state),
      type: doc.sender_type,
    },
    requestingSite: requestingSite(host),
  };
}

// Small parcel to the store's own suburb; only proves couriers will price.
const SAMPLE_PARCEL = { length: 20, width: 20, height: 10, weight: 1, quantity: 1 };

const NO_PRICES_MESSAGE =
  "Key works, but Transdirect returned no courier prices for this account. Ask Transdirect to activate API quoting.";

async function sampleQuote({ apiKey, sender, requestingSite: site }) {
  const { postcode, suburb, state } = sender;
  const quotes = await quoteShipment(apiKey, {
    declaredValue: 50,
    requestingSite: site,
    items: [SAMPLE_PARCEL],
    sender,
    receiver: { postcode, suburb, state, type: ADDRESS_TYPE.RESIDENTIAL },
  }).catch((err) => {
    // A 503 is every courier failing, which here means the account.
    if (err.status === 503) return [];
    throw err;
  });
  if (!quotes.length) throw httpError(NO_PRICES_MESSAGE, 422);
  return quotes[0];
}

/** Checks the key, the ship-from suburb, and that couriers return a price. */
async function testConnection(tenantId) {
  const transdirect = await getTransdirectConfig(tenantId);
  if (!transdirect) throw httpError("Save an API key and ship-from postcode and suburb first", 422);
  const { postcode, suburb } = transdirect.sender;
  const locations = await locationsForPostcode(transdirect.apiKey, postcode);
  const match = locations.some((l) => l.suburb.toUpperCase() === suburb.toUpperCase());
  if (!match) {
    const known = locations.slice(0, 5).map((l) => l.suburb).join(", ");
    throw httpError(`"${suburb}" isn't in postcode ${postcode}${known ? ` (try ${known})` : ""}`, 422);
  }
  const best = await sampleQuote(transdirect);
  return { ok: true, sample: { courier: best.courier, total: best.total } };
}

module.exports = { getSettings, updateSettings, getTransdirectConfig, testConnection, requestingSite };
