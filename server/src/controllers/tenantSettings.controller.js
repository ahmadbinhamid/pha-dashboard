// controllers/tenantSettings.controller.js

const tenantSettingsService = require("../services/tenantSettings.service");
const { success, notFound, requestfailure, systemfailure } = require("../utils/http/response");

exports.getSettings = async (req, res) => {
  try {
    const tenant = await tenantSettingsService.getTenant(req.tenantId);
    const payment_link_preview = tenantSettingsService.getPaymentLinkPreview(tenant);
    return success(res, { ...tenant.toObject(), payment_link_preview });
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    return systemfailure(res, err);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const tenant = await tenantSettingsService.updateTenantProfile(req.tenantId, req.body);
    const payment_link_preview = tenantSettingsService.getPaymentLinkPreview(tenant);
    return success(res, { ...tenant.toObject(), payment_link_preview }, "Settings updated");
  } catch (err) {
    if (err.status === 404) return notFound(res, err.message);
    if (err.status) return requestfailure(res, err);
    return systemfailure(res, err);
  }
};

// The one shared webhook URL every tenant's Stripe account delivers to, identity carried only
// in the opaque ?wt= token, mirroring ebay.controller.js's webhook URL construction.
function buildWebhookUrl(req, webhookToken) {
  return `${req.protocol}://${req.get("host")}/api/v1/payment/webhook?wt=${webhookToken}`;
}

// BYOK: saves the tenant's Stripe keys (validated against Stripe) and best-effort auto-registers
// the webhook endpoint on their account.
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

// Manual fallback for when automatic webhook registration failed; the tenant creates the
// endpoint themselves and pastes back the signing secret.
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

// BYOK: saves the tenant's own SMTP credentials (a real connection+auth handshake is attempted
// before persisting) so order email sends from their own mailbox.
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
