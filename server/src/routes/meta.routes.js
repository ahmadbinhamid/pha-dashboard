// routes/meta.routes.js
// Meta connect flow only; listings use the generic /listings API.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const oauthV = require("../validators/meta.oauth.validation");
const ctrl = require("../controllers/meta.controller");

router.get("/oauth/connect-url", auth(), requirePermission("integrations.update"), asyncHandler(ctrl.getConnectUrl));
// Public: Meta redirects the browser here directly, no JWT available.
router.get("/oauth/callback", asyncHandler(ctrl.oauthCallback));
router.get("/oauth/businesses", auth(), requirePermission("integrations.update"), asyncHandler(ctrl.getBusinesses));
router.post("/oauth/complete", auth(), requirePermission("integrations.update"), validate(oauthV.completeConnect), asyncHandler(ctrl.completeConnect));

module.exports = router;
