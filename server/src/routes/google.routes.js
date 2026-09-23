// routes/google.routes.js
// OAuth connect flow + listing CREATE/UPDATE, mirroring ebay.routes.js. Status/logs/retry and
// listing browse/read/delete/push are generic — see channel.routes.js and listing.routes.js.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const v = require("../validators/google.listing.validation");
const oauthV = require("../validators/google.oauth.validation");
const ctrl = require("../controllers/google.controller");
const listingCtrl = require("../controllers/google.listing.controller");

// ── OAuth consent flow (consent first, account picked after) ─────────
router.get("/oauth/connect-url", auth(), asyncHandler(ctrl.getConnectUrl));
// Public — Google redirects the browser here directly, no JWT available.
router.get("/oauth/callback", asyncHandler(ctrl.oauthCallback));
router.get("/oauth/accounts", auth(), asyncHandler(ctrl.getAccounts));
router.post("/oauth/complete", auth(), validate(oauthV.completeConnect), asyncHandler(ctrl.completeConnect));

// ── Listings (create/update only — see routes/listing.routes.js for the rest) ──
router.post("/listings", auth(), validate(v.createListing), asyncHandler(listingCtrl.createListing));
router.put("/listings/:id", auth(), validate(v.updateListing), asyncHandler(listingCtrl.updateListing));

module.exports = router;
