// models/User.js

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { NOTIFICATION_EVENT } = require("../constants/notification.constants");
const passwordHashingPlugin = require("./plugins/passwordHashing.plugin");
const { hashPassword } = require("../utils/auth/crypto");
const { USER_ROLE, USER_STATUS } = require("../constants/user.constants");

const notificationPreferencesSchema = new Schema(
  {
    events: {
      type: new Schema(
        Object.fromEntries(Object.values(NOTIFICATION_EVENT).map((key) => [key, { type: Boolean, default: true }])),
        { _id: false },
      ),
      default: () => ({}),
    },
    show_toasts: { type: Boolean, default: true },
  },
  { _id: false },
);

const userSchema = buildSchema({
  // Backfilled by scripts/backfillTenantId.js; part of the unique email index.
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
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
  two_factor_enabled: {
    type: Boolean,
    default: false,
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
  // Personal opt-outs; recipient queries treat a missing event as on.
  notification_preferences: { type: notificationPreferencesSchema, default: () => ({}) },
});

userSchema.virtual("full_name").get(function () {
  return `${this.first_name} ${this.last_name}`.trim();
});

userSchema.index(
  { tenant_id: 1, email: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);

userSchema.plugin(passwordHashingPlugin, {
  field: "password",
  hash: hashPassword,
});

module.exports = model("User", userSchema);
