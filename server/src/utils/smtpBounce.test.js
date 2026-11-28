// utils/smtpBounce.test.js
// Only dead mailboxes count as bounces; throttling and spam blocks don't.

const test = require("node:test");
const assert = require("node:assert/strict");
const { isHardBounce } = require("./smtpBounce");

const failed = (response, extra = {}) => ({ ok: false, permanent: true, response, ...extra });

test("unknown mailboxes are hard bounces", () => {
  assert.equal(isHardBounce(failed("550 5.1.1 The email account that you tried to reach does not exist")), true);
  assert.equal(isHardBounce(failed("550 No such user here")), true);
  assert.equal(isHardBounce(failed("553 5.1.3 Invalid address")), true);
  assert.equal(isHardBounce(failed("550 5.2.1 Mailbox disabled")), true);
});

test("a recipient the server refused outright is a bounce", () => {
  assert.equal(isHardBounce({ ok: false, permanent: true, recipientRejected: true }), true);
});

test("throttling, spam blocks and transient errors are not bounces", () => {
  assert.equal(isHardBounce(failed("550 5.7.0 Too many emails per second. Please upgrade your plan")), false);
  assert.equal(isHardBounce(failed("554 5.7.1 Message rejected as spam")), false);
  assert.equal(isHardBounce(failed("550 5.1.1 quota exceeded, try again later")), false);
  assert.equal(isHardBounce({ ok: false, permanent: false, response: "421 4.7.0 Try again later" }), false);
  assert.equal(isHardBounce({ ok: true }), false);
});
