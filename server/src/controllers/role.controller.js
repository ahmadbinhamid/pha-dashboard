// controllers/role.controller.js

const roleService = require("../services/role.service");
const { PERMISSION_GROUPS } = require("../config/permissions");
const { success, created, notFound, systemfailure } = require("../utils/http/response");

exports.listRoles = async (req, res) => {
  try {
    const roles = await roleService.listRoles(req.tenantId);
    return success(res, roles);
  } catch (err) {
    return systemfailure(res, err);
  }
};

/**
 * The permission catalogue the matrix in Settings renders from. Served rather
 * than duplicated in the dashboard so the list a role can be given is always
 * the list the server will accept.
 */
exports.listPermissions = async (req, res) => {
  try {
    return success(res, PERMISSION_GROUPS);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getRole = async (req, res) => {
  try {
    const role = await roleService.getRoleById(req.params.id, req.tenantId);
    if (!role) return notFound(res, "Role not found");
    return success(res, role);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createRole = async (req, res) => {
  try {
    const role = await roleService.createRole(req.tenantId, req.body);
    return created(res, role);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateRole = async (req, res) => {
  try {
    const role = await roleService.updateRole(req.params.id, req.tenantId, req.body);
    if (!role) return notFound(res, "Role not found");
    return success(res, role);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const role = await roleService.deleteRole(req.params.id, req.tenantId);
    if (!role) return notFound(res, "Role not found");
    return success(res, null, "Role deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
