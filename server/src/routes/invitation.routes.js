// routes/invitation.routes.js
// Per-route auth: public (token is the credential), invitee, or tenant Admin.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const validate = require("../middlewares/validate");
const { auth, requirePermission } = require("../middlewares/auth");
const { loginLimiter } = require("../middlewares/rateLimit");
const V = require("../validators/access.validation");
const ctrl = require("../controllers/invitation.controller");

// ── Organisation ──
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

// ── Invitee, signed in ──
router.post("/token/:token/accept", auth(), validate(V.invitationTokenParam), asyncHandler(ctrl.acceptInvitation));
router.post("/token/:token/decline", auth(), validate(V.invitationTokenParam), asyncHandler(ctrl.declineInvitation));

// ── Public: under /token so an id is never read as a token ──
router.get("/token/:token", validate(V.invitationTokenParam), asyncHandler(ctrl.getInvitationByToken));
router.post("/token/:token/register", validate(V.registerFromInvitation), asyncHandler(ctrl.registerFromInvitation));
// Rate-limited like login: the token is the only credential here.
router.post("/token/:token/activate", loginLimiter, validate(V.activateInvitation), asyncHandler(ctrl.activateInvitation));

module.exports = router;
