// models/User.js
const { model } = require("mongoose");
const { buildSchema } = require("./base.model");
const passwordHashingPlugin = require("./plugins/passwordHashing.plugin");
const { hashPassword } = require("../utils/crypto");

const userSchema = buildSchema({
  first_name: { type: String, required: true, trim: true },
  last_name: { type: String, required: true, trim: true },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  }, // uniqueness enforced via partial index below (soft-delete compatible)

  phone: {
    type: String,
    trim: true,
    default: null,
  },

  password: { type: String, required: true, minlength: 6, select: false },
  profile_image: { type: String, default: null },
  role: {
    type: String,
    enum: ["user", "admin", "superadmin"],
    default: "user",
  },
  status: {
    type: Number,
    default: 0,
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
    select: false, // Don't include in queries by default for security
  },
  password_reset_expiry: {
    type: Date,
    default: null,
  },
});

// Virtual
userSchema.virtual("full_name").get(function () {
  return `${this.first_name} ${this.last_name}`.trim();
});

// Enforce uniqueness among active users only (works with soft delete)
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } }
);

// Hash password
userSchema.plugin(passwordHashingPlugin, {
  field: "password",
  hash: hashPassword,
});

module.exports = model("User", userSchema);
