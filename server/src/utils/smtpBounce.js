// utils/smtpBounce.js
// Tells a dead mailbox apart from other permanent SMTP failures.

// 5.1.x is "bad destination mailbox"; 5.2.1 is "mailbox disabled".
const BAD_MAILBOX_STATUS = /\b5\.(1\.\d|2\.1)\b/;
const BAD_MAILBOX_TEXT = /(user|mailbox|recipient|address)\b.{0,40}\b(unknown|not found|does not exist|no such|invalid|unavailable|disabled|rejected)|no such (user|mailbox)/i;
// Throttling also comes back as 5xx on some hosts; it is never a bounce.
const THROTTLE_TEXT = /too many|rate limit|try again|quota|throttl/i;

/** True only when the receiving server says the recipient can't exist. */
function isHardBounce(result) {
  if (!result || result.ok) return false;
  if (result.recipientRejected) return true;
  if (!result.permanent) return false;
  const text = String(result.response || "");
  if (THROTTLE_TEXT.test(text)) return false;
  return BAD_MAILBOX_STATUS.test(text) || BAD_MAILBOX_TEXT.test(text);
}

module.exports = { isHardBounce };
