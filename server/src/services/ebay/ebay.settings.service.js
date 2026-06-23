// services/ebay/ebay.settings.service.js

const crypto = require("crypto");
const EbaySettings = require("../../models/EbaySettings");

async function getSettings() {
  return (await EbaySettings.findOne().lean()) || {};
}

async function upsertSettings(update) {
  return EbaySettings.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
}

async function ensureVerificationToken() {
  let settings = await EbaySettings.findOne();
  if (!settings) settings = new EbaySettings();

  if (!settings.verification_token) {
    settings.verification_token = crypto.randomBytes(32).toString("hex");
    await settings.save();
  }

  return settings.verification_token;
}

module.exports = { getSettings, upsertSettings, ensureVerificationToken };
