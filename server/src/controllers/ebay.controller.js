// controllers/ebay.controller.js

const ebayService = require("../services/ebay/ebay.service");
const ebayApiService = require("../services/ebay/ebay.api.service");
const webhookService = require("../services/ebay/ebay.webhook.service");
const settingsService = require("../services/ebay/ebay.settings.service");
const catalogService = require("../services/ebay/ebay.catalog.service");
const policiesService = require("../services/ebay/ebay.policies.service");
const config = require("../config");
const { logger } = require("../loaders/logging");
const {
  success,
  badRequest,
  unauthorized,
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

    const token = await ebayService.getAccessToken();
    return success(res, { connected: !!token });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
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

    const settings = await settingsService.upsertSettings(update);
    return success(res, settings, "eBay settings updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.handleWebhookChallenge = async (req, res) => {
  try {
    const { challenge_code } = req.query;
    if (!challenge_code) return badRequest(res, "Missing challenge_code");

    const settings = await settingsService.getSettings();
    if (!settings.verification_token)
      return badRequest(res, "Webhook not configured — call POST /webhook/subscribe first");

    let endpointUrl = config.ebay.webhookEndpointUrl;
    if (!endpointUrl) {
      logger.warn(
        "[ebay.controller] EBAY_WEBHOOK_ENDPOINT_URL is not set — falling back to request-derived URL. " +
        "Set this env var to the exact URL registered in eBay's Marketplace Account Deletion form."
      );
      endpointUrl = `${req.protocol}://${req.get("host")}/api/v1/ebay/webhook`;
    }

    const challengeResponse = webhookService.verifyChallenge(
      challenge_code,
      endpointUrl,
      settings.verification_token,
    );

    return res.status(200).json({ challengeResponse });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.handleWebhook = async (req, res) => {
  try {
    const settings = await settingsService.getSettings();
    if (!settings.verification_token)
      return unauthorized(res, "Webhook not configured — call POST /webhook/subscribe first");

    const signatureHeader = req.headers["x-ebay-signature"];
    const valid = webhookService.verifySignature(
      req.rawBody,
      signatureHeader,
      settings.verification_token,
    );
    if (!valid) return unauthorized(res, "Invalid signature");

    // Respond immediately — eBay retries on non-2xx
    success(res, { received: true });

    webhookService.processNotification(req.body).catch((err) => {
      logger.error("[ebay.controller] processNotification error", { error: err.message });
    });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.subscribeWebhook = async (req, res) => {
  try {
    const { endpoint_url } = req.body || {};

    const verificationToken = await settingsService.ensureVerificationToken();

    let endpointUrl = endpoint_url || config.ebay.webhookEndpointUrl;
    if (!endpointUrl) {
      logger.warn(
        "[ebay.controller] EBAY_WEBHOOK_ENDPOINT_URL is not set — falling back to request-derived URL. " +
        "Set this env var to the exact URL registered in eBay's Marketplace Account Deletion form."
      );
      endpointUrl = `${req.protocol}://${req.get("host")}/api/v1/ebay/webhook`;
    }

    const subscriptions = await webhookService.subscribeToTopics(endpointUrl, verificationToken);

    return success(res, { subscriptions, endpoint: endpointUrl }, "Webhook subscriptions registered");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getCategorySuggestions = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return badRequest(res, "Query parameter 'q' is required");
    const result = await catalogService.getCategorySuggestions(q);
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getConditionPolicies = async (req, res) => {
  try {
    const categoryId = (req.query.categoryId || "").trim();
    if (!categoryId) return badRequest(res, "Query parameter 'categoryId' is required");
    const result = await catalogService.getConditionPolicies(categoryId);
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getBusinessPolicies = async (req, res) => {
  try {
    const result = await policiesService.getBusinessPolicies();
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getCategoryAspects = async (req, res) => {
  try {
    const categoryId = (req.query.categoryId || "").trim();
    if (!categoryId) return badRequest(res, "categoryId is required");
    const aspects = await ebayApiService.getItemAspectsForCategory(categoryId);
    return success(res, { aspects });
  } catch (err) {
    return systemfailure(res, err);
  }
};
