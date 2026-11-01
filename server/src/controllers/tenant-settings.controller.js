// controllers/tenant-settings.controller.js

const tenantSettingsService = require("../services/tenant-settings.service");
const { success, notFound, requestfailure, systemfailure } = require("../utils/http/response");

exports.getSettings = async (req, res) => {
  try {
    const tenant = await tenantSettingsService.getTenant(req.tenantId);
    const payment_link_preview = tenantSettingsService.getPaymentLinkPreview(tenant);
    return success(res, { ...tenantSettingsService.toTenantResponse(tenant), payment_link_preview });
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    return systemfailure(res, err);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const tenant = await tenantSettingsService.updateTenantProfile(req.tenantId, req.body);
    const payment_link_preview = tenantSettingsService.getPaymentLinkPreview(tenant);
    return success(res, { ...tenantSettingsService.toTenantResponse(tenant), payment_link_preview }, "Settings updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

// One shared webhook URL for every tenant; the opaque ?wt= token says which.
function buildWebhookUrl(req, webhookToken) {
  return `${req.protocol}://${req.get("host")}/api/v1/payment/webhook?wt=${webhookToken}`;
}

// BYOK: keys are checked against Stripe; webhook auto-registers best-effort.
exports.updateStripeKeys = async (req, res) => {
  try {
    const webhookToken = await tenantSettingsService.ensureStripeWebhookToken(req.tenantId);
    const webhookUrl = buildWebhookUrl(req, webhookToken);
    const status = await tenantSettingsService.updateStripeKeys(req.tenantId, req.body, webhookUrl);
    return success(res, status, "Stripe keys updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.getStripeStatus = async (req, res) => {
  try {
    const status = await tenantSettingsService.getStripeStatus(req.tenantId);
    const webhookUrl = status.webhook_token ? buildWebhookUrl(req, status.webhook_token) : null;
    return success(res, { ...status, webhook_url: webhookUrl });
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    return systemfailure(res, err);
  }
};

// Manual fallback when auto-registration failed: tenant pastes the secret.
exports.updateStripeWebhookSecret = async (req, res) => {
  try {
    const status = await tenantSettingsService.updateStripeWebhookSecret(req.tenantId, req.body.webhook_secret);
    return success(res, status, "Webhook secret updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

// BYOK SMTP: a real login is tried first, so order email uses their mailbox.
exports.updateSmtpCredentials = async (req, res) => {
  try {
    const status = await tenantSettingsService.updateSmtpCredentials(req.tenantId, req.body);
    return success(res, status, "Email settings updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

exports.getSmtpStatus = async (req, res) => {
  try {
    const status = await tenantSettingsService.getSmtpStatus(req.tenantId);
    return success(res, status);
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    return systemfailure(res, err);
  }
};
