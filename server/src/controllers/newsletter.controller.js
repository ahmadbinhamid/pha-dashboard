// controllers/newsletter.controller.js

const { sendNewsletterSignupNotification } = require("../services/email/email.service");
const { getCompanyProfile } = require("../services/tenant-settings.service");
const { subscribeFromNewsletter } = require("../services/campaign/contact.service");
const { getPopupSignupReward } = require("../services/storefront.service");
const { SIGNUP_SOURCE } = require("../constants/storefront.constants");
const { success, systemfailure } = require("../utils/http/response");
const { logger } = require("../loaders/logging");

// Saving the subscriber is the point; the owner alert is a courtesy.
async function notifyOwner(tenantId, subscriberEmail) {
  try {
    const { email } = await getCompanyProfile(tenantId);
    if (email) await sendNewsletterSignupNotification({ to: email, subscriberEmail });
  } catch (err) {
    logger.warn("[newsletter] owner notification failed", { tenantId: String(tenantId), error: err.message });
  }
}

async function subscribe(req, res) {
  try {
    const { email, first_name, source } = req.body;
    // A popup signup joins the popup's list and earns its code, if live.
    const reward = source === SIGNUP_SOURCE.POPUP ? await getPopupSignupReward(req.tenantId, email) : null;
    const lists = reward?.list_name ? [reward.list_name] : [];
    const { created } = await subscribeFromNewsletter(req.tenantId, { email, first_name, lists });
    if (created) await notifyOwner(req.tenantId, email);
    const offer = reward?.offer;
    const data = reward
      ? {
          discount_code: offer?.used || offer?.expired ? null : (offer?.code ?? null),
          expires_at: offer?.expires_at ?? null,
          already_used: Boolean(offer?.used),
          expired: Boolean(offer?.expired),
        }
      : null;
    return success(res, data, "Subscribed successfully.");
  } catch (err) {
    return systemfailure(res, err);
  }
}

module.exports = { subscribe };
