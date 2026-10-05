// routes/google.routes.js
// Google OAuth, plus deprecated listing aliases of the generic /listings API.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const oauthV = require("../validators/google.oauth.validation");
const ctrl = require("../controllers/google.controller");
const listingCtrl = require("../controllers/listing.controller");
const { forPlatform, validateListingCreate, validateListingUpdate } = require("../middlewares/validateListing");
const { MARKETPLACE_PLATFORM } = require("../constants/marketplace.constants");

const GOOGLE = MARKETPLACE_PLATFORM.GOOGLE;

// ── OAuth: consent first, account picked after ──
router.get("/oauth/connect-url", auth(), requirePermission("integrations.update"), asyncHandler(ctrl.getConnectUrl));
// Public — Google redirects the browser here directly, no JWT available.
router.get("/oauth/callback", asyncHandler(ctrl.oauthCallback));
router.get("/oauth/accounts", auth(), requirePermission("integrations.update"), asyncHandler(ctrl.getAccounts));
router.post("/oauth/complete", auth(), requirePermission("integrations.update"), validate(oauthV.completeConnect), asyncHandler(ctrl.completeConnect));

// NOTE: deprecated aliases of POST /listings and PUT /listings/:id.
router.post("/listings", auth(), requirePermission("listings.create"), forPlatform(GOOGLE), validateListingCreate, asyncHandler(listingCtrl.createListing));
router.put("/listings/:id", auth(), requirePermission("listings.update"), forPlatform(GOOGLE), validateListingUpdate, asyncHandler(listingCtrl.updateListing));

module.exports = router;
