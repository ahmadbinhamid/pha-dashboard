// services/ebay/ebay.settings.service.js

const crypto = require("crypto");
const EbaySettings = require("../../models/EbaySettings");
const { logger } = require("../../loaders/logging");

async function getSettings() {
  return (await EbaySettings.findOne().lean()) || {};
}

async function upsertSettings(update) {
  const settings = await EbaySettings.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  logger.info("[ebay.settings] Settings updated", { fields: Object.keys(update) });
  return settings;
}

async function ensureVerificationToken() {
  let settings = await EbaySettings.findOne();
  if (!settings) settings = new EbaySettings();

  if (!settings.verification_token) {
    settings.verification_token = crypto.randomBytes(32).toString("hex");
    await settings.save();
    logger.info("[ebay.settings] Verification token generated and saved");
  }

  return settings.verification_token;
}

module.exports = { getSettings, upsertSettings, ensureVerificationToken };
