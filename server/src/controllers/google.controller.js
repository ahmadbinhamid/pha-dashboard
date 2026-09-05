// controllers/google.controller.js
//
// Thin HTTP layer only — all DB/API work happens in services/google/*, per
// this codebase's own service-layer convention. Mirrors
// controllers/ebay.controller.js's OAuth section shape. Status/logs/retry
// are already covered generically by GET /api/v1/channels and its
// sub-routes (see channel.routes.js/channel.controller.js) — not
// duplicated here.

const oauthService = require("../services/google/google.oauth.service");
const { logger } = require("../loaders/logging");
const config = require("../config");
const { success, badRequest, systemfailure } = require("../utils/http/response");

// Authenticated — returns the URL the dashboard should navigate to so the
// tenant's admin can grant consent on Google's own hosted screen. Google
// additionally needs the tenant's merchant_id/feed_label/content_language/
// target_country up front (see google.oauth.service.js#buildConsentUrl's
// own comment on why — unlike eBay, OAuth itself never hands these back).
exports.getConnectUrl = async (req, res) => {
  try {
    const { merchantId, feedLabel, contentLanguage, targetCountry } = req.query;
    if (!merchantId || !feedLabel || !contentLanguage || !targetCountry) {
      return badRequest(res, "merchantId, feedLabel, contentLanguage and targetCountry are all required");
    }
    const url = oauthService.buildConsentUrl({ tenantId: req.tenantId, merchantId, feedLabel, contentLanguage, targetCountry });
    return success(res, { url });
  } catch (err) {
    return systemfailure(res, err);
  }
};

// Public — Google redirects the browser here directly after consent, so
// there's no JWT to authenticate the request with. Trust is instead placed
// in the signed `state` round-tripped through Google (see
// google.oauth.service.js).
exports.oauthCallback = async (req, res) => {
  const dashboardUrl = config.emailBrand.clientUrl;
  // /settings/google (not bare /settings — the settings index route just
  // Navigates to /settings/business-info, dropping any query string, so a
  // bare /settings?google_connect=... would never actually reach
  // GoogleConnectCard's success/error banner).
  const redirect = (params) => res.redirect(`${dashboardUrl}/settings/google?${new URLSearchParams(params).toString()}`);

  try {
    const { code, state, error: consentError } = req.query;
    if (consentError) return redirect({ google_connect: "error", reason: consentError });
    if (!code || !state) return redirect({ google_connect: "error", reason: "missing_code_or_state" });

    const { tenantId, merchantId, feedLabel, contentLanguage, targetCountry } = oauthService.resolveState(state);
    await oauthService.completeConnection({ tenantId, code, merchantId, feedLabel, contentLanguage, targetCountry });

    // Kick off the tenant's first full-catalogue sync now that the data
    // source is ready. NOTE: this run doesn't add a separate manual
    // "resync everything" admin route — Task 3's scope is the sync_batch
    // mechanism itself, and this connect-time trigger is the one call site
    // that actually needs it, per the "only build what's used" instruction.
    // A future manual-resync route (if ever added) would just call
    // enqueueChannelJob the same way.
    try {
      const { enqueueChannelJob } = require("../queues/channel.queue");
      // Longer timeout than the queue's 60s default — a full-catalogue
      // sync legitimately runs far longer than a single-listing push.
      await enqueueChannelJob("google", "sync_batch", { tenantId: String(tenantId) }, { timeout: 30 * 60_000 });
    } catch (err) {
      // Never turn a successful connect into an error redirect over a
      // queue hiccup — the data source and credentials are already saved.
      logger.warn("[google.controller] failed to enqueue initial sync_batch after connect", {
        tenantId: String(tenantId),
        error: err.message,
      });
    }

    logger.info("[google.controller] Tenant connected via OAuth", { tenantId: String(tenantId) });
    return redirect({ google_connect: "success" });
  } catch (err) {
    // err.cause is where Node's fetch (undici) actually puts the real
    // network-level reason for a generic "fetch failed" TypeError (DNS
    // failure, connect timeout, TLS error, etc.) — found live: this was
    // logging only "fetch failed" with no way to tell it apart from a real
    // Google-side rejection, which hid an IPv6-routing timeout to
    // merchantapi.googleapis.com behind an unhelpful message.
    logger.error("[google.controller] oauthCallback error", {
      error: err.message,
      cause: err.cause ? String(err.cause) : undefined,
      code: err.code,
    });
    // err.code from google.datasource.service.js#createDataSource's own
    // recovery paths — surfaced as specific reasons rather than the generic
    // "exchange_failed" so the tenant (and GoogleConnectCard's error
    // banner) gets an actionable message instead of "something went wrong."
    if (err.code === "GCP_REGISTRATION_PENDING") {
      return redirect({ google_connect: "error", reason: "registration_pending" });
    }
    if (err.code === "GCP_REGISTRATION_CONFLICT") {
      return redirect({ google_connect: "error", reason: "registration_conflict" });
    }
    return redirect({ google_connect: "error", reason: "exchange_failed" });
  }
};
