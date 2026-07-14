const {
  sendNewsletterWelcome,
  sendNewsletterSignupNotification,
} = require("../services/email/email.service");
const { success, systemfailure } = require("../utils/http/response");

async function subscribe(req, res) {
  try {
    const { email } = req.body;

    await Promise.all([
      sendNewsletterWelcome({ to: email }),
      sendNewsletterSignupNotification({ subscriberEmail: email }),
    ]);

    return success(res, null, "Subscribed successfully.");
  } catch (err) {
    return systemfailure(res, err);
  }
}

module.exports = { subscribe };
