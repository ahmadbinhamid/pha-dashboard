// routes/ebay.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/ebay.listing.validation");
const settingsV = require("../validators/ebay.settings.validation");
const ctrl = require("../controllers/ebay.controller");
const listingCtrl = require("../controllers/ebay.listing.controller");

// ── eBay account / settings ──
router.get("/status", auth(), requirePermission("integrations.view"), asyncHandler(ctrl.getStatus));
router.get("/settings", auth(), requirePermission("integrations.view"), asyncHandler(ctrl.getSettings));
router.put("/settings", auth(), requirePermission("integrations.update"), validate(settingsV.updateSettings), asyncHandler(ctrl.updateSettings));
router.get("/category-suggestions", auth(), requirePermission("listings.view"), asyncHandler(ctrl.getCategorySuggestions));
router.get("/condition-policies", auth(), requirePermission("listings.view"), asyncHandler(ctrl.getConditionPolicies));
router.get("/business-policies", auth(), requirePermission("listings.view"), asyncHandler(ctrl.getBusinessPolicies));
router.get("/category-aspects", auth(), requirePermission("listings.view"), asyncHandler(ctrl.getCategoryAspects));

// ── eBay listings CRUD ──
router.post("/listings", auth(), requirePermission("listings.create"), validate(v.createListing), asyncHandler(listingCtrl.createListing));
router.get(
  "/listings",
  auth(), requirePermission("listings.view"),
  pagination(),
  validate(v.listListings),
  asyncHandler(listingCtrl.getListings),
);
router.get("/listings/:id", auth(), requirePermission("listings.view"), asyncHandler(listingCtrl.getListing));
router.put("/listings/:id", auth(), requirePermission("listings.update"), validate(v.updateListing), asyncHandler(listingCtrl.updateListing));
router.delete("/listings/:id", auth(), requirePermission("listings.delete"), asyncHandler(listingCtrl.deleteListing));
router.post("/listings/:id/push", auth(), requirePermission("listings.update"), asyncHandler(listingCtrl.pushListing));

// Webhook: no JWT, HMAC-verified; opaque `wt` param picks the tenant.
router.get("/webhook", asyncHandler(ctrl.handleWebhookChallenge));
router.post("/webhook", asyncHandler(ctrl.handleWebhook));

// Admin — register webhook subscription with eBay
router.post("/webhook/subscribe", auth(), requirePermission("integrations.update"), asyncHandler(ctrl.subscribeWebhook));

// ── OAuth consent flow ──
router.get("/oauth/connect-url", auth(), requirePermission("integrations.update"), asyncHandler(ctrl.getConnectUrl));
// Public — eBay redirects the browser here directly, no JWT available.
router.get("/oauth/callback", asyncHandler(ctrl.oauthCallback));

module.exports = router;
