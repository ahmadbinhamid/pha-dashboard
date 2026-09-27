// controllers/invitation.controller.js
// Thin: calls invite.service, sends the matching email, shapes the response.

const config = require("../config");
const { signJwt } = require("../utils/auth/jwt");
const inviteService = require("../services/invite.service");
const { getCompanyProfile } = require("../services/tenantSettings.service");
const { sendTeamInvite, sendTeamSetPassword, sendTeamAdded } = require("../services/email/email.service");
const { success, created, notFound, systemfailure } = require("../utils/http/response");

const clientUrl = (path) => `${config.emailBrand.clientUrl.replace(/\/$/, "")}${path}`;
const setPasswordUrl = (token) => clientUrl(`/set-password?token=${encodeURIComponent(token)}`);
// Pre-flow invites still land on the old join page.
const legacyInviteUrl = (token) => clientUrl(`/invite?token=${encodeURIComponent(token)}`);

const fullName = (user) => (user ? `${user.first_name} ${user.last_name}`.trim() : null);

// Team emails come from the platform; the tenant appears only by name.
async function teamEmailContext(tenantId, inviter) {
  const companyProfile = await getCompanyProfile(tenantId);
  return { organisationName: companyProfile?.company_name || "your team", inviterName: fullName(inviter) };
}

async function deliverSetPassword({ tenantId, email, firstName, token, inviter }) {
  return sendTeamSetPassword({
    ...(await teamEmailContext(tenantId, inviter)),
    to: email,
    firstName,
    setPasswordUrl: setPasswordUrl(token),
    expiresInHours: config.invites.expiryHours,
  });
}

async function deliverLegacyInvite({ tenantId, invitation, token, inviter }) {
  return sendTeamInvite({
    ...(await teamEmailContext(tenantId, inviter)),
    to: invitation.email,
    roleName: invitation.role_id?.name || null,
    inviteUrl: legacyInviteUrl(token),
    expiresAt: invitation.expires_at,
  });
}

// ── Inviting organisation ──

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
    const { first_name, last_name, email, role_id } = req.body;
    const result = await inviteService.inviteUser({
      tenantId: req.tenantId,
      firstName: first_name,
      lastName: last_name,
      email,
      roleId: role_id || null,
      invitedBy: req.user._id,
    });

    if (result.mode === "added") {
      await sendTeamAdded({
        ...(await teamEmailContext(req.tenantId, req.user)),
        to: email,
        firstName: result.user.first_name,
        loginUrl: clientUrl("/login"),
      });
      return created(res, { mode: "added", email }, "They already had an account and were added to this organisation");
    }

    await deliverSetPassword({ tenantId: req.tenantId, email, firstName: first_name, token: result.token, inviter: req.user });
    return created(res, { mode: "invited", ...result.invitation }, "Invite sent");
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

    const { invitation, token, pendingUser } = result;
    if (pendingUser) {
      await deliverSetPassword({ tenantId: req.tenantId, email: invitation.email, firstName: pendingUser.first_name, token, inviter: req.user });
    } else {
      await deliverLegacyInvite({ tenantId: req.tenantId, invitation, token, inviter: req.user });
    }
    return success(res, invitation, "Invite resent; the previous link no longer works");
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

// ── Invitee ──

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

/** Public: sets the invitee's first password; the client then logs in. */
exports.activateInvitation = async (req, res) => {
  try {
    const result = await inviteService.activateInvite(req.params.token, req.body.password);
    return success(res, result, "Password set");
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
    // Signs them in so the link is a one-step join; same token shape as login.
    const token = signJwt({ sub: String(user._id), role: user.role });
    return created(res, { user, token }, "Account created");
  } catch (err) {
    return systemfailure(res, err);
  }
};
