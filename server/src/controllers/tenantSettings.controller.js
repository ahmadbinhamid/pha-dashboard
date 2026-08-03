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

// The one shared webhook URL every tenant's own Stripe account delivers to,
// their real identity carried only in the opaque ?wt= token — mirrors
// ebay.controller.js's webhook URL construction.
function buildWebhookUrl(req, webhookToken) {
  return `${req.protocol}://${req.get("host")}/api/v1/payment/webhook?wt=${webhookToken}`;
}

// BYOK — saves this tenant's own Stripe secret/publishable key (validated
// against Stripe itself) and, best-effort, auto-registers our webhook
// endpoint on their account so they never have to do it by hand.
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

// Manual fallback for when automatic webhook registration failed (e.g. a
// restricted API key without webhook_endpoints:write) — the tenant creates
// the endpoint themselves in their Stripe Dashboard (using the webhook_url
// from GET .../stripe/status) and pastes back the signing secret Stripe gives them.
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

// BYOK — saves this tenant's own SMTP host/port/username/password (a real
// connection + auth handshake is attempted before persisting, no message
// sent) so their customer-facing order email sends from their own mailbox
// instead of the platform's shared one.
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
