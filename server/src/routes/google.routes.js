// routes/google.routes.js
//
// OAuth connect flow only, mirroring routes/ebay.routes.js's own OAuth
// section shape. Status/logs/retry are already generic — see
// routes/channel.routes.js, reused as-is rather than duplicated here.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const ctrl = require("../controllers/google.controller");

// ── OAuth consent flow ───────────────────────────────────────────────────────
router.get("/oauth/connect-url", auth(), asyncHandler(ctrl.getConnectUrl));
// Public — Google redirects the browser here directly, no JWT available.
router.get("/oauth/callback", asyncHandler(ctrl.oauthCallback));

module.exports = router;
