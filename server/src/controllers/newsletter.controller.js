const { sendNewsletterSignupNotification } = require("../services/email/email.service");
const { getCompanyProfile } = require("../services/tenantSettings.service");
const { success, requestfailure, systemfailure } = require("../utils/http/response");

async function subscribe(req, res) {
  try {
    const { email } = req.body;

    const companyProfile = await getCompanyProfile(req.tenantId);
    if (!companyProfile.email) {
      return requestfailure(res, { message: "This store hasn't configured a notification inbox yet", status: 409 });
    }

    await sendNewsletterSignupNotification({ to: companyProfile.email, subscriberEmail: email });

    return success(res, null, "Subscribed successfully.");
  } catch (err) {
    return systemfailure(res, err);
  }
}

module.exports = { subscribe };
