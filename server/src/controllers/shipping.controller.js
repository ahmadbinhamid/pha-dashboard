// controllers/shipping.controller.js

const shippingQuoteService = require("../services/shipping/shipping-quote.service");
const shippingSettingsService = require("../services/shipping/shipping-settings.service");
const { success, systemfailure } = require("../utils/http/response");

exports.quote = async (req, res) => {
  try {
    return success(res, await shippingQuoteService.quoteCart(req.tenantId, req.body));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getSettings = async (req, res) => {
  try {
    return success(res, await shippingSettingsService.getSettings(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    return success(res, await shippingSettingsService.updateSettings(req.tenantId, req.body), "Shipping settings saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.testConnection = async (req, res) => {
  try {
    return success(res, await shippingSettingsService.testConnection(req.tenantId), "Transdirect connection works");
  } catch (err) {
    return systemfailure(res, err);
  }
};
