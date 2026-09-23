// validators/access.validation.js
//
// Shapes for the team surface: members, roles and invitations.

const Joi = require("joi");
const { ALL_PERMISSIONS } = require("../config/permissions");
const { MEMBERSHIP_STATUS, INVITE_STATUS } = require("../constants/access.constants");

const objectId = Joi.string().hex().length(24);

// ── Members ─────────────────────────────────────────────────────────────────

const updateMember = {
  params: Joi.object({ userId: objectId.required() }),
  // At least one of the two, so "nothing to update" can't quietly 200.
  body: Joi.object({
    role_id: objectId,
    status: Joi.string().valid(...Object.values(MEMBERSHIP_STATUS)),
  }).min(1),
};

const memberIdParam = {
  params: Joi.object({ userId: objectId.required() }),
};

const tenantIdParam = {
  params: Joi.object({ tenantId: objectId.required() }),
};

// ── Roles ───────────────────────────────────────────────────────────────────

// Validated against the catalogue here too, so a typo gets a field-level 400, not a 422 deeper in.
const permissionList = Joi.array().items(Joi.string().valid(...ALL_PERMISSIONS)).min(1);

const createRole = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(60).required(),
    description: Joi.string().trim().max(200).allow("", null),
    permissions: permissionList.required(),
  }),
};

const updateRole = {
  params: Joi.object({ id: objectId.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(2).max(60),
    description: Joi.string().trim().max(200).allow("", null),
    permissions: permissionList,
  }).min(1),
};

const roleIdParam = {
  params: Joi.object({ id: objectId.required() }),
};

// ── Invitations ─────────────────────────────────────────────────────────────

const sendInvitation = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    role_id: objectId.required(),
  }),
};

const listInvitations = {
  query: Joi.object({
    status: Joi.string().valid(...Object.values(INVITE_STATUS)),
  }),
};

const invitationIdParam = {
  params: Joi.object({ id: objectId.required() }),
};

// Opaque to everything but the hash lookup; length is the only thing worth asserting.
const invitationTokenParam = {
  params: Joi.object({ token: Joi.string().trim().min(16).max(256).required() }),
};

const registerFromInvitation = {
  params: invitationTokenParam.params,
  body: Joi.object({
    first_name: Joi.string().trim().min(1).max(60).required(),
    last_name: Joi.string().trim().min(1).max(60).required(),
    password: Joi.string().min(6).max(128).required(),
    phone: Joi.string().trim().max(30).allow("", null),
  }),
};

module.exports = {
  updateMember,
  memberIdParam,
  tenantIdParam,
  createRole,
  updateRole,
  roleIdParam,
  sendInvitation,
  listInvitations,
  invitationIdParam,
  invitationTokenParam,
  registerFromInvitation,
};
