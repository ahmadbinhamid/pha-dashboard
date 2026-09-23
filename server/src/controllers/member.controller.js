// controllers/member.controller.js
// The people in the current organisation. Everything here acts on the membership, never the
// user account, so it affects this organisation only.

const membershipService = require("../services/membership.service");
const { success, notFound, systemfailure } = require("../utils/http/response");

exports.listMembers = async (req, res) => {
  try {
    const members = await membershipService.listMembers(req.tenantId);
    return success(res, members);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateMember = async (req, res) => {
  try {
    const membership = await membershipService.updateMember(req.params.userId, req.tenantId, {
      roleId: req.body.role_id,
      status: req.body.status,
    });
    if (!membership) return notFound(res, "That person isn't a member of this organisation");
    return success(res, membership);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.removeMember = async (req, res) => {
  try {
    const membership = await membershipService.removeMember(req.params.userId, req.tenantId);
    if (!membership) return notFound(res, "That person isn't a member of this organisation");
    return success(res, null, "Member removed from this organisation");
  } catch (err) {
    return systemfailure(res, err);
  }
};

/** Every organisation the signed-in user belongs to — powers the org switcher. */
exports.listMyOrganisations = async (req, res) => {
  try {
    const memberships = await membershipService.listUserMemberships(req.user._id);
    return success(res, memberships);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.setDefaultOrganisation = async (req, res) => {
  try {
    const membership = await membershipService.setDefaultMembership(req.user._id, req.params.tenantId);
    if (!membership) return notFound(res, "You aren't a member of that organisation");
    return success(res, membership, "Default organisation updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};
