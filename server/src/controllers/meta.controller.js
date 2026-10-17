// controllers/meta.controller.js
// Thin HTTP layer for Meta's connect flow; work lives in services/meta/*.

const oauthService = require("../services/meta/meta.oauth.service");
const channelService = require("../services/marketplace/channel.service");
const { logger } = require("../loaders/logging");
const config = require("../config");
const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");
const { META_CONNECT_ERROR_REASON } = require("../constants/meta.constants");
const { success, badRequest, systemfailure } = require("../utils/http/response");

const META = MARKETPLACE_PLATFORM.META;

// Known err.code values go out as `reason`; badRequest() has no such slot.
function failWithReason(res, err) {
  const reason = META_CONNECT_ERROR_REASON[err.code];
  if (!reason) return null;
  return res.status(400).json({ status: "Fail", systemfailure: false, message: err.message, reason, data: null });
}

// Blocks tenants without a verified storefront: Meta links shoppers there.
exports.getConnectUrl = async (req, res) => {
  try {
    const storefrontCheck = await channelService.checkStorefrontRequirement(req.tenantId, META);
    if (!storefrontCheck.ok) return badRequest(res, storefrontCheck.reason);
    return success(res, { url: oauthService.buildConsentUrl({ tenantId: req.tenantId }) });
  } catch (err) {
    return systemfailure(res, err);
  }
};

// NOTE: lookup errors fall to the picker, which shows them with a reconnect.
async function connectIfSingleCatalog(tenantId) {
  try {
    const conn = await oauthService.connectSingleGrantedCatalog(tenantId);
    if (conn) await channelService.enqueueFullSync(META, tenantId);
    return !!conn;
  } catch (err) {
    logger.warn("[meta.controller] catalog auto-select skipped", { tenantId: String(tenantId), code: err.code, metaCode: err.metaCode });
    return false;
  }
}

// Public redirect target; trust comes from the signed `state`, not a JWT.
exports.oauthCallback = async (req, res) => {
  const redirect = (params) =>
    res.redirect(`${config.emailBrand.clientUrl}/settings/integrations/meta?${new URLSearchParams(params).toString()}`);
  try {
    const { code, state, error: consentError } = req.query;
    if (consentError) return redirect({ meta_connect: "error", reason: consentError });
    if (!code || !state) return redirect({ meta_connect: "error", reason: "missing_code_or_state" });
    const { tenantId } = oauthService.resolveState(state);
    await oauthService.savePendingConnection({ tenantId, code });
    return redirect({ meta_connect: (await connectIfSingleCatalog(tenantId)) ? "success" : "choose_catalog" });
  } catch (err) {
    logger.error("[meta.controller] oauthCallback error", { error: err.message, cause: err.cause ? String(err.cause) : undefined, code: err.code });
    // NOTE: an expired signed state means the sign-in took over 10 minutes.
    const reason = err.name === "TokenExpiredError" ? META_CONNECT_ERROR_REASON.STATE_EXPIRED : "exchange_failed";
    return redirect({ meta_connect: "error", reason });
  }
};

// Granted catalogs for the picker; a Graph error surfaces with Meta's code.
exports.getCatalogs = async (req, res) => {
  try {
    return success(res, { catalogs: await oauthService.listGrantedCatalogs(req.tenantId) });
  } catch (err) {
    return failWithReason(res, err) ?? systemfailure(res, err);
  }
};

exports.completeConnect = async (req, res) => {
  try {
    const conn = await oauthService.completeConnection({
      tenantId: req.tenantId,
      catalogId: req.body.catalogId,
    });
    if (!conn) return badRequest(res, "No pending Meta sign-in found for this tenant — start the connect flow again.");
    await channelService.enqueueFullSync(META, req.tenantId);
    return success(res, { connected: true });
  } catch (err) {
    const handled = failWithReason(res, err);
    if (handled) return handled;
    logger.error("[meta.controller] completeConnect error", { error: err.message, code: err.code });
    return systemfailure(res, err);
  }
};

exports.disconnect = async (req, res) => {
  try {
    return success(res, { disconnected: await oauthService.disconnect(req.tenantId) });
  } catch (err) {
    logger.error("[meta.controller] disconnect error", { error: err.message });
    return systemfailure(res, err);
  }
};
