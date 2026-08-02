// middlewares/rateLimit.js
//
// Brute-force / abuse guards for endpoints that don't otherwise have a cost
// (login attempts, payment intent creation). Keyed by IP by default since
// these routes run before auth (or are hit by unauthenticated guests).

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

module.exports = { loginLimiter, paymentLimiter };
