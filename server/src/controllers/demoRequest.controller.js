const config = require("../config");
const { sendDemoRequestNotification } = require("../services/email/email.service");
const { success, requestfailure, systemfailure } = require("../utils/http/response");

async function submit(req, res) {
  const { full_name, business_name, phone, work_email, message } = req.body;

  if (!config.smtp.alertsTo) {
    return requestfailure(res, { message: "Demo requests aren't configured yet.", status: 409 });
  }

  const ok = await sendDemoRequestNotification({
    fullName: full_name,
    businessName: business_name,
    phone,
    workEmail: work_email,
    message,
  });

  if (!ok) {
    return systemfailure(res, new Error("Failed to send demo request. Please try again later."));
  }

  return success(res, null, "Demo request sent successfully.");
}

module.exports = { submit };
