// routes/google.routes.js
// OAuth plus listing create/update; the rest is in channel/listing routes.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/google.listing.validation");
const oauthV = require("../validators/google.oauth.validation");
const ctrl = require("../controllers/google.controller");
const listingCtrl = require("../controllers/google.listing.controller");

// ── OAuth: consent first, account picked after ──
router.get("/oauth/connect-url", auth(), requirePermission("integrations.update"), asyncHandler(ctrl.getConnectUrl));
// Public — Google redirects the browser here directly, no JWT available.
router.get("/oauth/callback", asyncHandler(ctrl.oauthCallback));
router.get("/oauth/accounts", auth(), requirePermission("integrations.update"), asyncHandler(ctrl.getAccounts));
router.post("/oauth/complete", auth(), requirePermission("integrations.update"), validate(oauthV.completeConnect), asyncHandler(ctrl.completeConnect));

// ── Listings: create/update only; the rest is listing.routes ──
router.post("/listings", auth(), requirePermission("listings.create"), validate(v.createListing), asyncHandler(listingCtrl.createListing));
router.put("/listings/:id", auth(), requirePermission("listings.update"), validate(v.updateListing), asyncHandler(listingCtrl.updateListing));

module.exports = router;
