const { sendInquiryNotification } = require("../services/email/email.service");
const { getCompanyProfile } = require("../services/tenantSettings.service");
const { success, requestfailure, systemfailure } = require("../utils/http/response");

async function submit(req, res) {
  const { name, email, phone, subject, message } = req.body;

  const companyProfile = await getCompanyProfile(req.tenantId);
  if (!companyProfile.email) {
    return requestfailure(res, { message: "This store hasn't configured an inquiry inbox yet", status: 409 });
  }

  const ok = await sendInquiryNotification({
    to: companyProfile.email,
    customerName: name,
    customerEmail: email,
    customerPhone: phone,
    subject,
    message,
  });

  if (!ok) {
    return systemfailure(res, new Error("Failed to send inquiry email. Please try again later."));
  }

  return success(res, null, "Inquiry sent successfully.");
}

module.exports = { submit };
