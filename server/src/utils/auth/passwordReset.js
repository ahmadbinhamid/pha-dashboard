const crypto = require("crypto");
const config = require("../../config");

function generateResetToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generateResetTokenExpiry() {
  return new Date(Date.now() + config.passwordReset.expiryMinutes * 60 * 1000);
}

function isResetTokenExpired(tokenExpiry) {
  if (!tokenExpiry) return true;
  return new Date() > tokenExpiry;
}

function isValidResetTokenFormat(token) {
  return /^[a-f0-9]{64}$/.test(token);
}

function createResetUrl(token) {
  return `${config.emailBrand.clientUrl}/auth/reset-password?token=${token}`;
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function verifyResetToken(plainToken, hashedToken) {
  return hashResetToken(plainToken) === hashedToken;
}

module.exports = {
  generateResetToken,
  generateResetTokenExpiry,
  isResetTokenExpired,
  isValidResetTokenFormat,
  createResetUrl,
  hashResetToken,
  verifyResetToken,
};
