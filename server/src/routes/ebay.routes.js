// routes/ebay.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/ebay.listing.validation");
const ctrl = require("../controllers/ebay.controller");
const listingCtrl = require("../controllers/ebay.listing.controller");

// ── eBay account / settings ───────────────────────────────────────────────────
router.get("/status", auth(), asyncHandler(ctrl.getStatus));
router.get("/settings", auth(), asyncHandler(ctrl.getSettings));
router.put("/settings", auth(), asyncHandler(ctrl.updateSettings));
router.get("/category-suggestions", auth(), asyncHandler(ctrl.getCategorySuggestions));
router.get("/condition-policies", auth(), asyncHandler(ctrl.getConditionPolicies));
router.get("/business-policies", auth(), asyncHandler(ctrl.getBusinessPolicies));
router.get("/category-aspects", auth(), asyncHandler(ctrl.getCategoryAspects));

// ── eBay listings CRUD ────────────────────────────────────────────────────────
router.post("/listings", auth(), asyncHandler(listingCtrl.createListing));
router.get(
  "/listings",
  auth(),
  pagination(),
  validate(v.listListings),
  asyncHandler(listingCtrl.getListings),
);
router.get("/listings/:id", auth(), asyncHandler(listingCtrl.getListing));
router.put("/listings/:id", auth(), asyncHandler(listingCtrl.updateListing));
router.delete("/listings/:id", auth(), asyncHandler(listingCtrl.deleteListing));
router.post("/listings/:id/push", auth(), asyncHandler(listingCtrl.pushListing));

// ── Webhook — no JWT auth (eBay calls these); HMAC-verified on POST. One
// shared URL for every tenant; the tenant is resolved from the opaque `wt`
// query param (see EbaySettings.webhook_token) rather than a real id in the
// path, so the URL itself can't be enumerated to discover tenants. ─────────
router.get("/webhook", asyncHandler(ctrl.handleWebhookChallenge));
router.post("/webhook", asyncHandler(ctrl.handleWebhook));

// Admin — register webhook subscription with eBay
router.post("/webhook/subscribe", auth(), asyncHandler(ctrl.subscribeWebhook));

// ── OAuth consent flow ───────────────────────────────────────────────────────
router.get("/oauth/connect-url", auth(), asyncHandler(ctrl.getConnectUrl));
// Public — eBay redirects the browser here directly, no JWT available.
router.get("/oauth/callback", asyncHandler(ctrl.oauthCallback));

module.exports = router;
