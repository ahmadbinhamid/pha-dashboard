// models/User.js

const { model } = require("mongoose");
const { buildSchema } = require("./base.model");
const passwordHashingPlugin = require("./plugins/passwordHashing.plugin");
const { hashPassword } = require("../utils/auth/crypto");
const { USER_ROLE, USER_STATUS } = require("../constants/user.constants");

const userSchema = buildSchema({
  first_name: { type: String, required: true, trim: true },
  last_name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },

  phone: {
    type: String,
    trim: true,
    default: null,
  },

  password: { type: String, required: true, minlength: 6, select: false },
  profile_image: { type: String, default: null },
  role: {
    type: String,
    enum: Object.values(USER_ROLE),
    default: USER_ROLE.USER,
  },
  status: {
    type: String,
    enum: Object.values(USER_STATUS),
    default: USER_STATUS.INACTIVE,
  },
  verified_at: {
    type: Date,
    default: null,
  },
  otp: {
    type: String,
    default: null,
    select: false,
  },
  otp_expiry: {
    type: Date,
    default: null,
  },
  password_reset_token: {
    type: String,
    default: null,
    select: false,
  },
  password_reset_expiry: {
    type: Date,
    default: null,
  },
});

userSchema.virtual("full_name").get(function () {
  return `${this.first_name} ${this.last_name}`.trim();
});

userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);

userSchema.plugin(passwordHashingPlugin, {
  field: "password",
  hash: hashPassword,
});

module.exports = model("User", userSchema);
