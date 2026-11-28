// services/discount-code.service.js
// Per-email codes for unique-code discounts: issuing and checkout lookup.

const crypto = require("crypto");
const DiscountCode = require("../models/DiscountCode");
const DiscountRedemption = require("../models/DiscountRedemption");
const { duplicateKeyField } = require("../utils/duplicateKey");
const { httpError } = require("../utils/http/httpError");
const { UNIQUE_CODE } = require("../constants/discount.constants");

const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeEmail = (email) => String(email).trim().toLowerCase();

function randomSuffix() {
  const bytes = crypto.randomBytes(UNIQUE_CODE.LENGTH);
  return Array.from(bytes, (b) => UNIQUE_CODE.ALPHABET[b % UNIQUE_CODE.ALPHABET.length]).join("");
}

const isExpired = (code, now = new Date()) => Boolean(code.expires_at && new Date(code.expires_at) <= now);

const toIssued = (doc, { used = false } = {}) => ({
  code: doc.code,
  expires_at: doc.expires_at,
  expired: isExpired(doc),
  used,
});

async function hasRedeemed(discountId, email) {
  return Boolean(await DiscountRedemption.exists({ discount_id: discountId, customer_key: email }));
}

async function createCode(tenantId, discount, email) {
  const expires = discount.code_valid_days ? new Date(Date.now() + discount.code_valid_days * DAY_MS) : null;
  for (let attempt = 0; attempt < UNIQUE_CODE.ISSUE_ATTEMPTS; attempt += 1) {
    try {
      const code = `${discount.code_prefix || UNIQUE_CODE.DEFAULT_PREFIX}-${randomSuffix()}`;
      return (await DiscountCode.create({ tenant_id: tenantId, discount_id: discount._id, code, email, expires_at: expires })).toObject();
    } catch (err) {
      const field = duplicateKeyField(err);
      // A concurrent signup for the same email won: hand back its code.
      if (field === "discount_id") return DiscountCode.findOne({ discount_id: discount._id, email }).lean();
      if (field !== "code") throw err;
    }
  }
  throw httpError("Couldn't issue a code, please try again", 503);
}

/** This email's code for the offer; the same one if they sign up again. */
async function issueCodeForEmail(tenantId, discount, rawEmail) {
  const email = normalizeEmail(rawEmail);
  const existing = await DiscountCode.findOne({ discount_id: discount._id, email }).lean();
  if (existing) return toIssued(existing, { used: await hasRedeemed(discount._id, email) });
  if (await hasRedeemed(discount._id, email)) return { code: null, expires_at: null, expired: false, used: true };
  // created: only a brand-new code is emailed, so re-signups don't spam.
  return { ...toIssued(await createCode(tenantId, discount, email)), created: true };
}

/** Checks an issued code against the checkout email; null if not issued. */
async function findIssuedCode(tenantId, code, customerEmail) {
  const issued = await DiscountCode.findOne({ tenant_id: tenantId, code }).lean();
  if (!issued) return null;
  if (!customerEmail) throw httpError("Enter the email you signed up with to use this code", 400);
  if (issued.email !== normalizeEmail(customerEmail)) {
    throw httpError("This code belongs to a different email address", 400);
  }
  if (isExpired(issued)) throw httpError("This code has expired", 400);
  return issued;
}

async function countIssuedCodes(discountId) {
  return DiscountCode.countDocuments({ discount_id: discountId });
}

module.exports = { issueCodeForEmail, findIssuedCode, countIssuedCodes };
