const User = require("../models/User");
const { success, notFound, unauthorized, systemfailure } = require("../utils/http/response");
const { PUBLIC_SELECT } = require("../utils/user");

exports.getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, skip = 0 } = req.pagination || {};
    const { status } = req.query || {};

    const filter = {};
    if (status == 1) filter.status = 1;
    if (status == 0) filter.status = 0;

    const [items, total] = await Promise.all([
      User.find(filter).select(PUBLIC_SELECT).skip(skip).limit(limit).sort({ created_at: -1 }),
      User.countDocuments(filter),
    ]);

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

    const profile = await User.findById(id).select(PUBLIC_SELECT);
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

    const user = await User.findByIdAndUpdate(
      id,
      { first_name, last_name },
      { new: true, runValidators: true, select: PUBLIC_SELECT },
    );

    if (!user) return notFound(res, "User not found");

    return success(res, user, "Profile updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const doc = await User.findById(req.params.id);
    if (!doc) return notFound(res, "User not found");
    await doc.softDelete();
    return success(res, null, "User deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
