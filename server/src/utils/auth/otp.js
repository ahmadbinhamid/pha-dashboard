const { randomInt, createHash } = require("crypto");
const config = require("../../config");

function generateOTP() {
  return randomInt(100000, 1000000).toString();
}

function generateOTPExpiry() {
  return new Date(Date.now() + config.otp.expiryMinutes * 60 * 1000);
}

function isOTPExpired(otpExpiry) {
  if (!otpExpiry) return true;
  return new Date() > otpExpiry;
}

function hashOTP(otp) {
  return createHash("sha256").update(String(otp)).digest("hex");
}

module.exports = { generateOTP, generateOTPExpiry, isOTPExpired, hashOTP };
