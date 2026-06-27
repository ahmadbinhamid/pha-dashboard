const { sendInquiryNotification } = require("../services/email/email.service");
const { success, systemfailure } = require("../utils/http/response");

async function submit(req, res) {
  const { name, email, phone, subject, message } = req.body;

  const ok = await sendInquiryNotification({
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
