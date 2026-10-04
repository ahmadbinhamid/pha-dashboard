// middlewares/rateLimit.js
// Abuse guards for free-to-call endpoints, keyed by client IP by default.

// NOTE: MemoryStore is per process; two API instances need a shared store.
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const tooManyRequests = (message) => (req, res) =>
  res.status(429).json({ status: "Fail", systemfailure: false, message, data: null });

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const TRY_LATER = "Too many attempts. Please try again in 15 minutes.";

const ipKey = (req) => ipKeyGenerator(req.ip);

// IP + normalised email so a shared shop IP isn't one bucket; IP if no email.
function ipEmailKey(req) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  return email ? `${ipKey(req)}|${email}` : ipKey(req);
}

// Each call is its own counter, so one route's failures never starve another.
function authLimiter({ max, keyGenerator = ipKey, failuresOnly = true, message = TRY_LATER }) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skipSuccessfulRequests: failuresOnly,
    handler: tooManyRequests(message),
  });
}

// 5 failures per account: OWASP guidance for credential guessing.
const loginAccountLimiter = authLimiter({ max: 5, keyGenerator: ipEmailKey });
// 50 failures per IP: stops one source spraying many accounts.
const loginNetworkLimiter = authLimiter({
  max: 50,
  message: "Too many login attempts from this network. Please try again in 15 minutes.",
});
// 5 wrong codes per account: a 6-digit OTP is otherwise guessable.
const otpVerifyLimiter = authLimiter({ max: 5, keyGenerator: ipEmailKey });
// Every request counts: each one sends an email, success or not.
const otpResendLimiter = authLimiter({ max: 5, keyGenerator: ipEmailKey, failuresOnly: false });
// NOTE: counts every request; forgot-password answers 200 for unknown emails.
const forgotPasswordLimiter = authLimiter({ max: 5, keyGenerator: ipEmailKey, failuresOnly: false });
// Token guessing; the body carries no email, so per IP.
const passwordResetLimiter = authLimiter({ max: 10 });
// Account creation and invite activation keep login's old per-IP limits.
const signupLimiter = authLimiter({ max: 5 });
const inviteActivateLimiter = authLimiter({ max: 5 });

// 1 min / 10 attempts: payment intent creation is cheap to spam otherwise.
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  handler: tooManyRequests("Too many payment requests. Please slow down."),
});

// 1 hour / 5 attempts: the public form queues a real email send.
const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests("Too many requests. Please try again later."),
});

// 15 min / 20 orders: generous for payment retries and carrier-grade NAT.
const guestOrderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests("Too many orders. Please try again in 15 minutes."),
});

module.exports = {
  loginAccountLimiter,
  loginNetworkLimiter,
  otpVerifyLimiter,
  otpResendLimiter,
  forgotPasswordLimiter,
  passwordResetLimiter,
  signupLimiter,
  inviteActivateLimiter,
  paymentLimiter,
  publicFormLimiter,
  guestOrderLimiter,
};
