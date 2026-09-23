// middlewares/rateLimit.js
//
// Brute-force/abuse guards for cost-free endpoints (login, payment intents), keyed by IP by default.

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const tooManyRequests = (message) => (req, res) =>
  res.status(429).json({ status: "Fail", systemfailure: false, message, data: null });

// 15 min / 5 attempts — matches OWASP guidance for credential-guessing endpoints.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: tooManyRequests("Too many attempts. Please try again in 15 minutes."),
});

// 1 min / 10 attempts — payment intent creation is cheap to spam otherwise.
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req.ip),
  handler: tooManyRequests("Too many payment requests. Please slow down."),
});

// 1 hour / 5 attempts — public form queues a real email send, otherwise free to spam.
const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: tooManyRequests("Too many requests. Please try again later."),
});

module.exports = { loginLimiter, paymentLimiter, publicFormLimiter };
