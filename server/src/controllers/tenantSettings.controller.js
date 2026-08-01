// controllers/tenantSettings.controller.js

const tenantSettingsService = require("../services/tenantSettings.service");
const { success, notFound, requestfailure, systemfailure } = require("../utils/http/response");

exports.getSettings = async (req, res) => {
  try {
    const tenant = await tenantSettingsService.getTenant(req.tenantId);
    return success(res, tenant);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    return systemfailure(res, err);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const tenant = await tenantSettingsService.updateTenantProfile(req.tenantId, req.body);
    return success(res, tenant, "Settings updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.connectStripe = async (req, res) => {
  try {
    const tenant = await tenantSettingsService.connectStripeAccount(req.tenantId);
    return success(res, tenant, "Stripe account created");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.createStripeAccountSession = async (req, res) => {
  try {
    const client_secret = await tenantSettingsService.createStripeAccountSession(req.tenantId);
    return success(res, { client_secret });
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.getStripeStatus = async (req, res) => {
  try {
    const status = await tenantSettingsService.getStripeConnectStatus(req.tenantId);
    return success(res, status);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    return systemfailure(res, err);
  }
};
