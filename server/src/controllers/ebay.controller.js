// controllers/ebay.controller.js

const ebayApiService = require("../services/ebay/ebay.api.service");
const webhookService = require("../services/ebay/ebay.webhook.service");
const settingsService = require("../services/ebay/ebay.settings.service");
const oauthService = require("../services/ebay/ebay.oauth.service");
const catalogService = require("../services/ebay/ebay.catalog.service");
const policiesService = require("../services/ebay/ebay.policies.service");
const Tenant = require("../models/Tenant");
const { logger } = require("../loaders/logging");
const config = require("../config");
const {
  success,
  badRequest,
  notFound,
  unauthorized,
  systemfailure,
} = require("../utils/http/response");

exports.getStatus = async (req, res) => {
  try {
    const settings = await settingsService.getSettings(req.tenantId);
    const configured = ebayApiService.credentialsConfigured(settings);

    if (!configured) {
      return success(res, {
        connected: false,
        reason: "eBay is not connected for this store — set a refresh token in eBay settings",
      });
    }

    const token = await ebayApiService.getAccessToken(settings);
    return success(res, { connected: !!token });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await settingsService.getSettings(req.tenantId);
    return success(res, settings);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const {
      marketplace_id,
      sandbox,
      merchant_location_key,
      fulfillment_policy_id,
      payment_policy_id,
      return_policy_id,
      warehouse_street,
      warehouse_city,
      warehouse_state,
      warehouse_postcode,
      warehouse_country,
      warehouse_phone,
      fallback_image_url,
    } = req.body || {};

    // refresh_token is intentionally not accepted here — it's only ever set
    // via the OAuth callback (oauthCallback below), never pasted by an admin.
    const update = {};
    if (marketplace_id !== undefined) update.marketplace_id = marketplace_id || "EBAY_AU";
    if (sandbox !== undefined) update.sandbox = !!sandbox;
    if (merchant_location_key !== undefined) update.merchant_location_key = merchant_location_key || null;
    if (fulfillment_policy_id !== undefined) update.fulfillment_policy_id = fulfillment_policy_id || null;
    if (payment_policy_id !== undefined) update.payment_policy_id = payment_policy_id || null;
    if (return_policy_id !== undefined) update.return_policy_id = return_policy_id || null;
    if (warehouse_street !== undefined) update.warehouse_street = warehouse_street || null;
    if (warehouse_city !== undefined) update.warehouse_city = warehouse_city || null;
    if (warehouse_state !== undefined) update.warehouse_state = warehouse_state || null;
    if (warehouse_postcode !== undefined) update.warehouse_postcode = warehouse_postcode || null;
    if (warehouse_country !== undefined) update.warehouse_country = warehouse_country || "AU";
    if (warehouse_phone !== undefined) update.warehouse_phone = warehouse_phone || null;
    if (fallback_image_url !== undefined) update.fallback_image_url = fallback_image_url || null;

    if (!Object.keys(update).length) {
      return badRequest(res, "No fields provided to update");
    }

    const settings = await settingsService.upsertSettings(req.tenantId, update);
    return success(res, settings, "eBay settings updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

// Webhook URL carries an opaque `wt` (webhook_token) instead of this
// tenant's real _id — see EbaySettings.webhook_token. Anyone who guesses/
// enumerates it still can't do anything without also forging the HMAC
// signature checked in handleWebhook, but not leaking a real database id in
// a public URL closes off tenant enumeration entirely.
exports.handleWebhookChallenge = async (req, res) => {
  try {
    const { challenge_code, wt } = req.query;
    if (!challenge_code) return badRequest(res, "Missing challenge_code");
    if (!wt) return badRequest(res, "Missing wt");

    const settings = await settingsService.findByWebhookToken(wt);
    if (!settings || !settings.verification_token) return notFound(res, "Webhook not configured");

    // Must byte-for-byte match the URL eBay was given when registering this
    // subscription (see subscribeWebhook below) — including the query string.
    const endpointUrl = `${req.protocol}://${req.get("host")}/api/v1/ebay/webhook?wt=${wt}`;

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
    const { wt } = req.query;
    if (!wt) return badRequest(res, "Missing wt");

    const settings = await settingsService.findByWebhookToken(wt);
    if (!settings || !settings.verification_token) return unauthorized(res, "Webhook not configured");

    const signatureHeader = req.headers["x-ebay-signature"];
    const valid = webhookService.verifySignature(
      req.rawBody,
      signatureHeader,
      settings.verification_token,
    );
    if (!valid) {
      // Diagnostic, not a fix: verifySignature checks HMAC-SHA256 against
      // the shared verification_token, but eBay's Notification API is
      // documented (unverified against real traffic — see PR/audit notes)
      // to sign POST deliveries with an asymmetric scheme (public key
      // fetched by keyId), not a shared secret. If that's correct, every
      // genuine eBay delivery 401s here, permanently, and the real-time
      // path silently never runs. Rather than guess at re-implementing an
      // unverified crypto scheme (risking a DIFFERENT wrong implementation
      // with false confidence), this logs what the header actually looks
      // like so the very next real delivery gives hard evidence instead —
      // check for a base64-decoded JSON payload containing a keyId/kid
      // field, which would confirm the asymmetric-signature hypothesis.
      let decodedPreview = null;
      try {
        decodedPreview = Buffer.from(signatureHeader || "", "base64").toString("utf8").slice(0, 500);
      } catch {
        // signatureHeader wasn't valid base64 — decodedPreview stays null
      }
      logger.warn("[ebay.controller] Webhook signature verification failed — see decodedPreview for scheme diagnosis", {
        hasSignatureHeader: !!signatureHeader,
        signatureHeaderLength: signatureHeader?.length || 0,
        decodedPreview,
      });
      return unauthorized(res, "Invalid signature");
    }

    const tenant = await Tenant.findById(settings.tenant_id);
    if (!tenant) return notFound(res, "Tenant not found");

    // Respond immediately — eBay retries on non-2xx
    success(res, { received: true });

    webhookService.processNotification(req.body, tenant).catch((err) => {
      logger.error("[ebay.controller] processNotification error", { error: err.message });
    });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.subscribeWebhook = async (req, res) => {
  try {
    const settings = await settingsService.getSettings(req.tenantId);
    const verificationToken = await settingsService.ensureVerificationToken(req.tenantId);
    const webhookToken = await settingsService.ensureWebhookToken(req.tenantId);

    const endpointUrl =
      req.body?.endpoint_url || `${req.protocol}://${req.get("host")}/api/v1/ebay/webhook?wt=${webhookToken}`;

    const subscriptions = await webhookService.subscribeToTopics(endpointUrl, verificationToken, settings);

    return success(res, { subscriptions, endpoint: endpointUrl }, "Webhook subscriptions registered");
  } catch (err) {
    return systemfailure(res, err);
  }
};

// ── OAuth consent flow ───────────────────────────────────────────────────────

// Authenticated — returns the URL the dashboard should navigate to so the
// tenant's admin can grant consent on eBay's own hosted screen.
exports.getConnectUrl = async (req, res) => {
  try {
    const sandbox = req.query.sandbox === "true";
    const url = oauthService.buildConsentUrl({ tenantId: req.tenantId, sandbox });
    return success(res, { url });
  } catch (err) {
    return systemfailure(res, err);
  }
};

// Public — eBay redirects the browser here directly after consent, so there
// is no JWT to authenticate the request with. Trust is instead placed in the
// signed `state` round-tripped through eBay (see ebay.oauth.service.js).
exports.oauthCallback = async (req, res) => {
  const dashboardUrl = config.emailBrand.clientUrl;
  const redirect = (params) => res.redirect(`${dashboardUrl}/settings?${new URLSearchParams(params).toString()}`);

  try {
    const { code, state, error: consentError } = req.query;
    if (consentError) return redirect({ ebay_connect: "error", reason: consentError });
    if (!code || !state) return redirect({ ebay_connect: "error", reason: "missing_code_or_state" });

    const { tenantId, sandbox } = oauthService.resolveState(state);
    const refreshToken = await oauthService.exchangeCodeForRefreshToken(code, sandbox);

    let settings = await settingsService.upsertSettings(tenantId, { refresh_token: refreshToken, sandbox });
    ebayApiService.clearTokenCache(tenantId);

    if (!settings.merchant_location_key) {
      settings = await autoFillMerchantLocationKey(tenantId, settings);
    }

    logger.info("[ebay.controller] Tenant connected via OAuth", { tenantId });
    return redirect({ ebay_connect: "success" });
  } catch (err) {
    logger.error("[ebay.controller] oauthCallback error", { error: err.message });
    return redirect({ ebay_connect: "error", reason: "exchange_failed" });
  }
};

// Best-effort — called right after a successful OAuth connect. If the seller
// already has a merchant location set up on eBay (e.g. from their seller
// hub), fill it in automatically so they don't have to copy the key by hand.
// Never throws: a failure here shouldn't turn a successful connect into an
// error redirect, since the key can still be entered manually in Settings.
async function autoFillMerchantLocationKey(tenantId, settings) {
  try {
    const token = await ebayApiService.getAccessToken(settings);
    if (!token) return settings;

    const locations = await ebayApiService.getInventoryLocations(token, settings);
    const key = locations[0]?.merchantLocationKey;
    if (!key) return settings;

    const updated = await settingsService.upsertSettings(tenantId, { merchant_location_key: key });
    logger.info("[ebay.controller] Auto-filled merchant_location_key from eBay", { tenantId, key });
    return updated;
  } catch (err) {
    logger.warn("[ebay.controller] Could not auto-fill merchant_location_key", { tenantId, error: err.message });
    return settings;
  }
}

exports.getCategorySuggestions = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return badRequest(res, "Query parameter 'q' is required");
    const settings = await settingsService.getSettings(req.tenantId);
    const result = await catalogService.getCategorySuggestions(q, settings);
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getConditionPolicies = async (req, res) => {
  try {
    const categoryId = (req.query.categoryId || "").trim();
    if (!categoryId) return badRequest(res, "Query parameter 'categoryId' is required");
    const settings = await settingsService.getSettings(req.tenantId);
    const result = await catalogService.getConditionPolicies(categoryId, settings);
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getBusinessPolicies = async (req, res) => {
  try {
    const settings = await settingsService.getSettings(req.tenantId);
    const result = await policiesService.getBusinessPolicies(settings);
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getCategoryAspects = async (req, res) => {
  try {
    const categoryId = (req.query.categoryId || "").trim();
    if (!categoryId) return badRequest(res, "categoryId is required");
    const settings = await settingsService.getSettings(req.tenantId);
    const aspects = await ebayApiService.getItemAspectsForCategory(categoryId, settings.marketplace_id);
    return success(res, { aspects });
  } catch (err) {
    return systemfailure(res, err);
  }
};
