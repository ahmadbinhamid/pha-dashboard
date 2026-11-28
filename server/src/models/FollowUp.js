// models/FollowUp.js
// An automatic email sent a set number of days after an order completes.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { FOLLOW_UP_TRIGGER, FOLLOW_UP_CHANNELS, FOLLOW_UP_LIMITS, RATING } = require("../constants/followup.constants");

const days = (fallback) => ({ type: Number, min: FOLLOW_UP_LIMITS.MIN_DAYS, max: FOLLOW_UP_LIMITS.MAX_DAYS, default: fallback });

const followUpSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true },
  trigger: { type: String, enum: Object.values(FOLLOW_UP_TRIGGER), default: FOLLOW_UP_TRIGGER.ORDER_FULFILLED },
  // Courier orders complete when shipped, so they wait longer than pickups.
  shipped_delay_days: days(FOLLOW_UP_LIMITS.DEFAULT_SHIPPED_DAYS),
  handover_delay_days: days(FOLLOW_UP_LIMITS.DEFAULT_HANDOVER_DAYS),
  channels: { type: [{ type: String, enum: FOLLOW_UP_CHANNELS }], default: () => [...FOLLOW_UP_CHANNELS] },
  subject: { type: String, default: "", trim: true },
  preheader: { type: String, default: "", trim: true },
  // Same builder JSON as campaigns; body_html is rendered from it on save.
  design: { type: Schema.Types.Mixed, default: null },
  body_html: { type: String, default: "" },
  ask_for_rating: { type: Boolean, default: true },
  // Ratings at or below this email the store; 0 turns alerts off.
  alert_at_or_below: { type: Number, min: 0, max: RATING.MAX, default: RATING.DEFAULT_ALERT_AT },
  alert_email: { type: String, default: "", trim: true, lowercase: true },
  enabled: { type: Boolean, default: false },
  // Only orders completed after this are emailed, so launch day is quiet.
  enabled_at: { type: Date, default: null },
});

followUpSchema.index({ tenant_id: 1, created_at: -1 });
followUpSchema.index({ enabled: 1 });

module.exports = model("FollowUp", followUpSchema);
