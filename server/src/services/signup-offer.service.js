// services/signup-offer.service.js
// The popup's signup offer: a unique-code Discount kept in step with settings.

const Discount = require("../models/Discount");
const { createDiscount, updateDiscount } = require("./discount.service");
const { discountStatus } = require("./discount-pricing.service");
const { issueCodeForEmail, countIssuedCodes } = require("./discount-code.service");
const { getCompanyProfile } = require("./tenant-settings.service");
const { getDefaultStorefrontHost } = require("./domain.service");
const { sendSignupOfferCode } = require("./email/email.service");
const { logger } = require("../loaders/logging");
const config = require("../config");
const { DISCOUNT_TYPE, DISCOUNT_SCOPE, DISCOUNT_STATUS, UNIQUE_CODE } = require("../constants/discount.constants");

const OFFER_NAME = "Signup popup offer";
const OFFER_FIELDS = ["discount_type", "discount_value", "minimum_order", "code_prefix", "code_valid_days"];

const DEFAULT_OFFER = Object.freeze({
  enabled: false,
  discount_type: DISCOUNT_TYPE.PERCENT,
  discount_value: 10,
  minimum_order: 0,
  code_prefix: UNIQUE_CODE.DEFAULT_PREFIX,
  code_valid_days: 30,
  issued_count: 0,
  redeemed_count: 0,
});

/** Only a unique-code discount counts as the popup's offer. */
async function findOfferDiscount(tenantId, discountId) {
  if (!discountId) return null;
  return Discount.findOne({ _id: discountId, tenant_id: tenantId, unique_codes: true }).lean();
}

/** Admin view of the offer, with how many codes went out and got used. */
async function getOffer(tenantId, discountId) {
  const discount = await findOfferDiscount(tenantId, discountId);
  if (!discount) return { ...DEFAULT_OFFER };
  return {
    enabled: discount.active,
    ...Object.fromEntries(OFFER_FIELDS.map((f) => [f, discount[f]])),
    issued_count: await countIssuedCodes(discount._id),
    redeemed_count: discount.usage_count,
  };
}

/** Creates or updates the offer's discount; returns the id to store. */
async function saveOffer(tenantId, discountId, offer) {
  const current = await findOfferDiscount(tenantId, discountId);
  if (!offer.enabled) {
    if (current) await updateDiscount(current._id, tenantId, { active: false });
    return current?._id ?? null;
  }
  const fields = {
    ...Object.fromEntries(OFFER_FIELDS.filter((f) => offer[f] !== undefined).map((f) => [f, offer[f]])),
    active: true,
  };
  if (current) return (await updateDiscount(current._id, tenantId, fields))._id;
  const created = await createDiscount(tenantId, {
    ...DEFAULT_OFFER,
    ...fields,
    name: OFFER_NAME,
    unique_codes: true,
    is_automatic: false,
    scope: DISCOUNT_SCOPE.STOREWIDE,
  });
  return created._id;
}

/** The offer when codes can be handed out right now, else null. */
async function liveOffer(tenantId, discountId) {
  const discount = await findOfferDiscount(tenantId, discountId);
  return discount && discountStatus(discount) === DISCOUNT_STATUS.LIVE ? discount : null;
}

/** "15% off", "$10 off" or "Free shipping", as the email headline. */
function offerLabel(discount) {
  if (discount.discount_type === DISCOUNT_TYPE.PERCENT) return `${discount.discount_value}% off`;
  if (discount.discount_type === DISCOUNT_TYPE.FIXED) return `$${discount.discount_value} off`;
  return "Free shipping";
}

const formatDate = (d) => new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

// Best effort: the code is already on screen, so a mail failure is logged only.
async function emailCode(tenantId, discount, email, issued) {
  try {
    const [companyProfile, host] = await Promise.all([getCompanyProfile(tenantId), getDefaultStorefrontHost(tenantId)]);
    await sendSignupOfferCode({
      to: email,
      code: issued.code,
      offerLabel: offerLabel(discount),
      minimumOrder: discount.minimum_order ? `$${Number(discount.minimum_order).toFixed(2)}` : null,
      expiresOn: issued.expires_at ? formatDate(issued.expires_at) : null,
      shopUrl: host ? `https://${host}` : config.emailBrand.storefrontUrl,
      companyProfile,
      tenantId,
    });
  } catch (err) {
    logger.warn("[signup-offer] code email failed", { tenantId: String(tenantId), error: err.message });
  }
}

/** This email's own code, or why there isn't one; null without an offer. */
async function claimOffer(tenantId, discountId, email) {
  const discount = await liveOffer(tenantId, discountId);
  if (!discount) return null;
  const issued = await issueCodeForEmail(tenantId, discount, email);
  if (issued.created && issued.code) await emailCode(tenantId, discount, email, issued);
  return issued;
}

module.exports = { getOffer, saveOffer, liveOffer, claimOffer };
