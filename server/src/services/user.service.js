// services/user.service.js

const User = require("../models/User");
const { PUBLIC_SELECT } = require("../utils/user");

async function listUsers(filter, { skip, limit, sort = { created_at: -1 } }) {
  const [items, total] = await Promise.all([
    User.find(filter).select(PUBLIC_SELECT).skip(skip).limit(limit).sort(sort),
    User.countDocuments(filter),
  ]);
  return { items, total };
}

async function getPublicUserById(id) {
  return User.findById(id).select(PUBLIC_SELECT);
}

async function updateUserProfile(id, { first_name, last_name }) {
  return User.findByIdAndUpdate(
    id,
    { first_name, last_name },
    { new: true, runValidators: true, select: PUBLIC_SELECT },
  );
}

async function deleteUser(id, tenantId) {
  const user = await User.findOne({ _id: id, tenant_id: tenantId });
  if (!user) return null;
  await user.softDelete();
  return user;
}

// ── Auth-related lookups ──────────────────────────────────────────────────

// tenantId is required at registration (a new user always belongs to exactly
// one tenant) but optional for login/password-reset lookups, which are
// email-only today — see auth.controller.js's login/verifyOTP/forgotPassword
// for the known ambiguity risk if the same email is ever registered against
// more than one tenant.
async function findUserByEmail(email, tenantId = null) {
  const filter = { email };
  if (tenantId) filter.tenant_id = tenantId;
  return User.findOne(filter);
}

async function createUser(data) {
  return User.create(data);
}

async function findUserByEmailWithPassword(email) {
  return User.findOne({ email }).select("+password");
}

async function findUserByEmailWithOtp(email) {
  return User.findOne({ email }).select("+otp +otp_expiry");
}

async function findUserByResetToken(hashedToken) {
  return User.findOne({ password_reset_token: hashedToken }).select(
    "+password_reset_token",
  );
}

async function findUserByIdWithPassword(id) {
  return User.findById(id).select("+password");
}

async function saveUser(user) {
  return user.save();
}

module.exports = {
  listUsers,
  getPublicUserById,
  updateUserProfile,
  deleteUser,
  findUserByEmail,
  createUser,
  findUserByEmailWithPassword,
  findUserByEmailWithOtp,
  findUserByResetToken,
  findUserByIdWithPassword,
  saveUser,
};
