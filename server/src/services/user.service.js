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

/** Everything but the password; auth middleware attaches it as req.user. */
async function findUserForAuth(id) {
  return User.findById(id).select("-password");
}

async function updateUserProfile(id, { first_name, last_name }) {
  return User.findByIdAndUpdate(
    id,
    { first_name, last_name },
    { new: true, runValidators: true, select: PUBLIC_SELECT },
  );
}

async function setTwoFactorEnabled(id, enabled) {
  return User.findByIdAndUpdate(
    id,
    { two_factor_enabled: enabled },
    { new: true, runValidators: true, select: PUBLIC_SELECT },
  );
}

async function deleteUser(id, tenantId) {
  const user = await User.findOne({ _id: id, tenant_id: tenantId });
  if (!user) return null;
  await user.softDelete();
  return user;
}

// ── Auth-related lookups ──

// tenantId is set at registration; login/reset look up by email alone.
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

// Email is unique per tenant only, so one person may have several accounts.
async function findAllUsersByEmailWithPassword(email) {
  return User.find({ email }).select("+password");
}

// Every account for the email; forgotPassword sends one reset link each.
async function findAllUsersByEmail(email) {
  return User.find({ email });
}

async function findUserByEmailWithOtp(email) {
  return User.findOne({ email }).select("+otp +otp_expiry");
}

// `userIds` are password-verified; confirms the chosen tenant matches one.
async function findUserAmongIdsForTenant(userIds, tenantId) {
  return User.findOne({ _id: { $in: userIds }, tenant_id: tenantId });
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
  findUserForAuth,
  listUsers,
  getPublicUserById,
  updateUserProfile,
  setTwoFactorEnabled,
  deleteUser,
  findUserByEmail,
  createUser,
  findUserByEmailWithPassword,
  findAllUsersByEmailWithPassword,
  findAllUsersByEmail,
  findUserAmongIdsForTenant,
  findUserByEmailWithOtp,
  findUserByResetToken,
  findUserByIdWithPassword,
  saveUser,
};
