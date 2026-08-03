// validators/auth.validation.js

const Joi = require("joi");
const { USER_STATUS } = require("../constants/user.constants");

const login = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().min(6).max(128).required(),
  }),
};

const changePassword = {
  body: Joi.object({
    current_password: Joi.string().min(6).max(128).required(),
    new_password: Joi.string()
      .min(6)
      .max(128)
      .disallow(Joi.ref("current_password"))
      .required(),
  }),
};

const register = {
  body: Joi.object({
    first_name: Joi.string().trim().min(1).max(50).required(),
    last_name: Joi.string().trim().min(1).max(50).required(),
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().min(6).max(128).required(),
    role: Joi.string().valid("user", "admin").default("user"),
    // Which tenant this staff account joins — required now that every User
    // is tenant-scoped. The storefront/dashboard client knows this from its
    // own deployment config (see CLAUDE.md's tenant provisioning notes).
    tenant_slug: Joi.string().trim().lowercase().required(),
  }),
};

// Self-service signup — creates a BRAND NEW tenant (unlike `register` above,
// which joins an existing one via tenant_slug). No tenant_slug here since
// there isn't one yet; tenant.service.js#registerTenantWithAdmin derives it
// from company_name.
const registerTenant = {
  body: Joi.object({
    company_name: Joi.string().trim().min(2).max(100).required(),
    first_name: Joi.string().trim().min(1).max(50).required(),
    last_name: Joi.string().trim().min(1).max(50).required(),
    email: Joi.string().trim().lowercase().email().required(),
    password: Joi.string().min(6).max(128).required(),
  }),
};

const verifyOTP = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    otp: Joi.string()
      .length(6)
      .pattern(/^\d{6}$/)
      .required(),
  }),
};

const resendOTP = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
  }),
};

const verifyAccount = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    status: Joi.string().valid(...Object.values(USER_STATUS)).required(),
  }),
};

const forgotPassword = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
  }),
};

const resetPassword = {
  body: Joi.object({
    token: Joi.string()
      .length(64)
      .pattern(/^[a-f0-9]{64}$/)
      .required(),
    new_password: Joi.string().min(6).max(128).required(),
  }),
};

module.exports = {
  login,
  changePassword,
  register,
  registerTenant,
  verifyOTP,
  verifyAccount,
  forgotPassword,
  resetPassword,
  resendOTP,
};
