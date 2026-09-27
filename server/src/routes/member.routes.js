// routes/member.routes.js
// Current org's people, plus the caller's own org list (no permission needed).

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, tenantAdmin } = require("../middlewares/auth");
const V = require("../validators/access.validation");
const ctrl = require("../controllers/member.controller");

router.use(auth());

// Feeds the org switcher, so it has no tenant gate.
router.get("/me/organisations", asyncHandler(ctrl.listMyOrganisations));
router.get("/me/access", asyncHandler(ctrl.getMyAccess));
router.put("/me/organisations/:tenantId/default", validate(V.tenantIdParam), asyncHandler(ctrl.setDefaultOrganisation));

router.get("/", tenantAdmin, asyncHandler(ctrl.listMembers));
router.patch("/:userId", tenantAdmin, validate(V.updateMember), asyncHandler(ctrl.updateMember));
router.delete("/:userId", tenantAdmin, validate(V.memberIdParam), asyncHandler(ctrl.removeMember));

module.exports = router;
