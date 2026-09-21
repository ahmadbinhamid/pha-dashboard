// routes/member.routes.js
//
// The current organisation's people, plus the signed-in user's own list of
// organisations (which needs no permission — it's their own membership).

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, requirePermission } = require("../middlewares/auth");
const V = require("../validators/access.validation");
const ctrl = require("../controllers/member.controller");

router.use(auth());

// Every organisation the caller belongs to — the org switcher's source.
router.get("/me/organisations", asyncHandler(ctrl.listMyOrganisations));
router.put("/me/organisations/:tenantId/default", validate(V.tenantIdParam), asyncHandler(ctrl.setDefaultOrganisation));

router.get("/", requirePermission("users.view"), asyncHandler(ctrl.listMembers));
router.patch("/:userId", requirePermission("users.update"), validate(V.updateMember), asyncHandler(ctrl.updateMember));
router.delete("/:userId", requirePermission("users.delete"), validate(V.memberIdParam), asyncHandler(ctrl.removeMember));

module.exports = router;
