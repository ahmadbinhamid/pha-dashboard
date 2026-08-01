const {
  listUsers,
  getPublicUserById,
  updateUserProfile,
  deleteUser,
} = require("../services/user.service");
const { success, notFound, unauthorized, systemfailure } = require("../utils/http/response");
const { USER_STATUS } = require("../constants/user.constants");

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, skip = 0 } = req.pagination || {};
    const { status } = req.query || {};

    const filter = { tenant_id: req.tenantId };
    if (status === USER_STATUS.ACTIVE) filter.status = USER_STATUS.ACTIVE;
    if (status === USER_STATUS.INACTIVE) filter.status = USER_STATUS.INACTIVE;

    const { items, total } = await listUsers(filter, { skip, limit });

    const totalPages = Math.ceil(total / limit) || 1;
    return success(res, { items, total, page, pageSize: limit, totalPages });
  } catch (err) {
    return systemfailure(res, err);
  }
};

// GET /user/profile  (self)
exports.getProfile = async (req, res) => {
  try {
    const id = req.user?._id || req.user?.sub;
    if (!id) return unauthorized(res, "Unauthorized");

    const profile = await getPublicUserById(id);
    if (!profile) return unauthorized(res, "Account not found");

    return success(res, profile, "Profile");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = req.user?._id || req.user?.sub;
    const { first_name, last_name } = req.body;

    const user = await updateUserProfile(id, { first_name, last_name });

    if (!user) return notFound(res, "User not found");

    return success(res, user, "Profile updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const doc = await deleteUser(req.params.id, req.tenantId);
    if (!doc) return notFound(res, "User not found");
    return success(res, null, "User deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
