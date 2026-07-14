const { sendNewsletterSignupNotification } = require("../services/email/email.service");
const { success, systemfailure } = require("../utils/http/response");

async function subscribe(req, res) {
  try {
    const { email } = req.body;

    await sendNewsletterSignupNotification({ subscriberEmail: email });

    return success(res, null, "Subscribed successfully.");
  } catch (err) {
    return systemfailure(res, err);
  }
}

module.exports = { subscribe };
