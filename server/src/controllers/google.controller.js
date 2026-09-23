// Thin HTTP layer for the Google OAuth connect flow; DB/API work lives in services/google/*.

const oauthService = require("../services/google/google.oauth.service");
const channelService = require("../services/marketplace/channel.service");
const { logger } = require("../loaders/logging");
const config = require("../config");
const { success, badRequest, systemfailure } = require("../utils/http/response");

// Returns Google's OAuth consent URL; blocks tenants without a verified storefront domain, which Merchant Center requires.
exports.getConnectUrl = async (req, res) => {
  try {
    const storefrontCheck = await channelService.checkStorefrontRequirement(req.tenantId, "google");
    if (!storefrontCheck.ok) return badRequest(res, storefrontCheck.reason);

    const url = oauthService.buildConsentUrl({ tenantId: req.tenantId });
    return success(res, { url });
  } catch (err) {
    return systemfailure(res, err);
  }
};

// Public OAuth redirect target; trust comes from the signed `state`, not a JWT. Exchanges the code and saves a PENDING connection.
exports.oauthCallback = async (req, res) => {
  const dashboardUrl = config.emailBrand.clientUrl;
  // Redirects to /settings/google specifically — bare /settings drops the query string before GoogleConnectCard sees it.
  const redirect = (params) => res.redirect(`${dashboardUrl}/settings/google?${new URLSearchParams(params).toString()}`);

  try {
    const { code, state, error: consentError } = req.query;
    if (consentError) return redirect({ google_connect: "error", reason: consentError });
    if (!code || !state) return redirect({ google_connect: "error", reason: "missing_code_or_state" });

    const { tenantId } = oauthService.resolveState(state);
    await oauthService.savePendingConnection({ tenantId, code });

    return redirect({ google_connect: "choose_account" });
  } catch (err) {
    // err.cause holds Node fetch's real network failure reason (DNS/timeout/TLS), else it just logs as generic "fetch failed".
    logger.error("[google.controller] oauthCallback error", {
      error: err.message,
      cause: err.cause ? String(err.cause) : undefined,
      code: err.code,
    });
    return redirect({ google_connect: "error", reason: "exchange_failed" });
  }
};

// Populates the account-picker dropdown; never hard-fails — returns listSupported: false so the frontend can fall back to manual entry.
exports.getAccounts = async (req, res) => {
  try {
    const accounts = await oauthService.listAccessibleAccounts(req.tenantId);
    return success(res, { accounts, listSupported: true });
  } catch (err) {
    if (err.code === "NO_PENDING_CONNECTION") return badRequest(res, err.message);
    logger.warn("[google.controller] accounts.list unavailable — falling back to manual entry", {
      tenantId: String(req.tenantId),
      error: err.message,
    });
    return success(res, { accounts: [], listSupported: false, message: err.message });
  }
};

// Finishes connect once the tenant picks/types a Merchant Center account; feedLabel/contentLanguage default server-side too.
exports.completeConnect = async (req, res) => {
  try {
    const { merchantId, targetCountry } = req.body;
    if (!merchantId) return badRequest(res, "merchantId is required");
    if (!targetCountry) return badRequest(res, "targetCountry is required");
    const feedLabel = req.body.feedLabel || targetCountry;
    const contentLanguage = req.body.contentLanguage || "en";

    // Re-verifies which accounts this token can reach, rejecting a mismatched merchantId before ensureDataSource, when possible.
    let verifiedAccountIds;
    try {
      const accounts = await oauthService.listAccessibleAccounts(req.tenantId);
      verifiedAccountIds = accounts.map((a) => String(a.accountId));
    } catch {
      verifiedAccountIds = undefined;
    }

    const conn = await oauthService.completeConnection({
      tenantId: req.tenantId,
      merchantId,
      feedLabel,
      contentLanguage,
      targetCountry,
      verifiedAccountIds,
    });

    if (!conn) {
      return badRequest(res, "No pending Google OAuth session found for this tenant — start the connect flow again.");
    }

    // Kicks off the tenant's first full-catalogue sync now that the data source is ready.
    try {
      const { enqueueChannelJob } = require("../queues/channel.queue");
      // Longer timeout than the queue's 60s default since a full sync runs much longer than a single push.
      await enqueueChannelJob("google", "sync_batch", { tenantId: String(req.tenantId) }, { timeout: 30 * 60_000 });
    } catch (err) {
      // A queue enqueue failure shouldn't turn an already-saved connection into an error response.
      logger.warn("[google.controller] failed to enqueue initial sync_batch after connect", {
        tenantId: String(req.tenantId),
        error: err.message,
      });
    }

    logger.info("[google.controller] Tenant finished connecting via OAuth", { tenantId: String(req.tenantId) });
    return success(res, { connected: true });
  } catch (err) {
    // Surfaces known err.code values as a `reason` field so the frontend shows its existing friendly copy; badRequest() has no such slot.
    const KNOWN_REASONS = {
      GCP_REGISTRATION_PENDING: "registration_pending",
      GCP_REGISTRATION_CONFLICT: "registration_conflict",
      MERCHANT_NOT_ACCESSIBLE: "merchant_not_accessible",
      NO_PENDING_CONNECTION: "no_pending_connection",
    };
    const reason = KNOWN_REASONS[err.code];
    if (reason) {
      return res.status(400).json({ status: "Fail", systemfailure: false, message: err.message, reason, data: null });
    }
    logger.error("[google.controller] completeConnect error", { error: err.message, code: err.code });
    return systemfailure(res, err);
  }
};
