// controllers/ebay.controller.js

const EbaySettings = require("../models/EbaySettings");
const ebayService = require("../services/ebay/ebay.service");
const {
  success,
  badRequest,
  systemfailure,
} = require("../utils/http/response");

exports.getStatus = async (req, res) => {
  try {
    const configured = ebayService.credentialsConfigured();

    if (!configured) {
      return success(res, {
        connected: false,
        reason: "EBAY_CLIENT_ID, EBAY_CLIENT_SECRET or EBAY_REFRESH_TOKEN missing",
      });
    }

    // Attempt a token fetch to verify credentials are valid
    const token = await ebayService.getAccessToken();
    return success(res, { connected: !!token });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = (await EbaySettings.findOne().lean()) || {};
    return success(res, settings);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const {
      merchant_location_key,
      fulfillment_policy_id,
      payment_policy_id,
      return_policy_id,
    } = req.body || {};

    const update = {};
    if (merchant_location_key !== undefined)
      update.merchant_location_key = merchant_location_key || null;
    if (fulfillment_policy_id !== undefined)
      update.fulfillment_policy_id = fulfillment_policy_id || null;
    if (payment_policy_id !== undefined)
      update.payment_policy_id = payment_policy_id || null;
    if (return_policy_id !== undefined)
      update.return_policy_id = return_policy_id || null;

    if (!Object.keys(update).length) {
      return badRequest(res, "No fields provided to update");
    }

    const settings = await EbaySettings.findOneAndUpdate(
      {},
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    return success(res, settings, "eBay settings updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};
