// controllers/invitation.controller.js
//
// Thin: validates what the route didn't, calls invite.service, shapes the
// response. Split across three audiences, matching how the routes are
// mounted — the inviting organisation, and the invitee (signed in or not).

const config = require("../config");
const { signJwt } = require("../utils/auth/jwt");
const inviteService = require("../services/invite.service");
const { getCompanyProfile } = require("../services/tenantSettings.service");
const { sendTeamInvite } = require("../services/email/email.service");
const { success, created, notFound, systemfailure } = require("../utils/http/response");

/**
 * The link the invitee clicks. The dashboard owns the landing page, so this
 * points at CLIENT_URL — the same base the other account emails use.
 */
function buildInviteUrl(token) {
  return `${config.emailBrand.clientUrl.replace(/\/$/, "")}/invite?token=${encodeURIComponent(token)}`;
}

/**
 * Email the link, from the inviting organisation's own brand. Deliberately
 * not awaited-into-failure: the invite itself is already saved, so a mail
 * problem shouldn't fail the request and leave the dashboard thinking nothing
 * happened — the link comes back in the response either way.
 */
async function deliverInvite({ tenantId, invitation, token, inviter }) {
  const companyProfile = await getCompanyProfile(tenantId);
  const inviterName = inviter ? `${inviter.first_name} ${inviter.last_name}`.trim() : null;

  return sendTeamInvite({
    to: invitation.email,
    organisationName: companyProfile?.company_name || "your team",
    inviterName,
    roleName: invitation.role_id?.name || null,
    inviteUrl: buildInviteUrl(token),
    expiresAt: invitation.expires_at,
    companyProfile,
    tenantId,
  });
}

// ── Inviting organisation ───────────────────────────────────────────────────

exports.listInvitations = async (req, res) => {
  try {
    const invitations = await inviteService.listInvitations(req.tenantId, { status: req.query.status });
    return success(res, invitations);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.sendInvitation = async (req, res) => {
  try {
    const { invitation, token } = await inviteService.sendInvite({
      tenantId: req.tenantId,
      email: req.body.email,
      roleId: req.body.role_id,
      invitedBy: req.user._id,
    });

    await deliverInvite({ tenantId: req.tenantId, invitation, token, inviter: req.user });

    // The only moment a shareable link exists — only its hash is stored, so
    // it can't be recovered afterwards (see models/Invitation.js).
    return created(res, { ...invitation, link: buildInviteUrl(token) });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.resendInvitation = async (req, res) => {
  try {
    const result = await inviteService.resendInvite({
      invitationId: req.params.id,
      tenantId: req.tenantId,
      invitedBy: req.user._id,
    });
    if (!result) return notFound(res, "Invitation not found");

    await deliverInvite({ tenantId: req.tenantId, invitation: result.invitation, token: result.token, inviter: req.user });

    return success(res, { ...result.invitation, link: buildInviteUrl(result.token) });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.revokeInvitation = async (req, res) => {
  try {
    const invitation = await inviteService.revokeInvite({ invitationId: req.params.id, tenantId: req.tenantId });
    if (!invitation) return notFound(res, "Invitation not found");
    return success(res, invitation);
  } catch (err) {
    return systemfailure(res, err);
  }
};

// ── Invitee ─────────────────────────────────────────────────────────────────

/** Public: what the landing page shows before anyone signs in. */
exports.getInvitationByToken = async (req, res) => {
  try {
    const preview = await inviteService.getInvitePreview(req.params.token);
    if (!preview) return notFound(res, "That invitation link is no longer valid");
    return success(res, preview);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.acceptInvitation = async (req, res) => {
  try {
    const invitation = await inviteService.acceptInvite(req.params.token, req.user);
    return success(res, invitation, "Invitation accepted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.declineInvitation = async (req, res) => {
  try {
    const invitation = await inviteService.declineInvite(req.params.token, req.user);
    return success(res, invitation, "Invitation declined");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.registerFromInvitation = async (req, res) => {
  try {
    const { user } = await inviteService.registerFromInvite(req.params.token, req.body);
    // Signing them in here is what makes the link a one-step join; the token
    // shape matches auth.controller's own login response.
    const token = signJwt({ sub: String(user._id), role: user.role });
    return created(res, { user, token }, "Account created");
  } catch (err) {
    return systemfailure(res, err);
  }
};
