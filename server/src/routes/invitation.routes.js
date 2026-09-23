// routes/invitation.routes.js
// Three audiences on one resource, so auth is applied per-route: public (the token is the
// credential), signed-in (accept/decline, no org yet), and organisation (users.* permissions).

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, requirePermission } = require("../middlewares/auth");
const V = require("../validators/access.validation");
const ctrl = require("../controllers/invitation.controller");

// ── Organisation ────────────────────────────────────────────────────────────
router.get("/", auth(), requirePermission("users.view"), validate(V.listInvitations), asyncHandler(ctrl.listInvitations));
router.post("/", auth(), requirePermission("users.create"), validate(V.sendInvitation), asyncHandler(ctrl.sendInvitation));
router.post(
  "/:id/resend",
  auth(),
  requirePermission("users.create"),
  validate(V.invitationIdParam),
  asyncHandler(ctrl.resendInvitation),
);
router.delete(
  "/:id",
  auth(),
  requirePermission("users.create"),
  validate(V.invitationIdParam),
  asyncHandler(ctrl.revokeInvitation),
);

// ── Invitee, signed in ──────────────────────────────────────────────────────
router.post("/token/:token/accept", auth(), validate(V.invitationTokenParam), asyncHandler(ctrl.acceptInvitation));
router.post("/token/:token/decline", auth(), validate(V.invitationTokenParam), asyncHandler(ctrl.declineInvitation));

// ── Public ──────────────────────────────────────────────────────────────────
// Namespaced under /token so a 24-char id can never be read as a token — those are permission-gated, these are not.
router.get("/token/:token", validate(V.invitationTokenParam), asyncHandler(ctrl.getInvitationByToken));
router.post("/token/:token/register", validate(V.registerFromInvitation), asyncHandler(ctrl.registerFromInvitation));

module.exports = router;
