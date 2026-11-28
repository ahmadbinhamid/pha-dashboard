// models/Campaign.js
// An email campaign: one-off send or a recurring newsletter on a schedule.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  CAMPAIGN_KIND,
  CAMPAIGN_STATUS,
  AUDIENCE_TYPE,
  RECURRENCE_FREQUENCY,
  MAX_MONTHLY_DAY,
  DEFAULT_TIMEZONE,
} = require("../constants/campaign.constants");

const recurrenceSchema = new Schema(
  {
    frequency: { type: String, enum: Object.values(RECURRENCE_FREQUENCY), default: RECURRENCE_FREQUENCY.WEEKLY },
    // 0 = Sunday, used by weekly and fortnightly.
    day_of_week: { type: Number, min: 0, max: 6, default: 1 },
    day_of_month: { type: Number, min: 1, max: MAX_MONTHLY_DAY, default: 1 },
    // "HH:mm" wall-clock time in `timezone`.
    time: { type: String, default: "09:00" },
    timezone: { type: String, default: DEFAULT_TIMEZONE },
  },
  { _id: false },
);

const campaignSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  name: { type: String, required: true, trim: true },
  kind: { type: String, enum: Object.values(CAMPAIGN_KIND), default: CAMPAIGN_KIND.ONE_TIME },
  status: { type: String, enum: Object.values(CAMPAIGN_STATUS), default: CAMPAIGN_STATUS.DRAFT },
  subject: { type: String, default: "", trim: true },
  preheader: { type: String, default: "", trim: true },
  // Sanitised HTML; merge tags filled per recipient at send time.
  body_html: { type: String, default: "" },
  audience: {
    type: { type: String, enum: Object.values(AUDIENCE_TYPE), default: AUDIENCE_TYPE.ALL },
    lists: { type: [String], default: [] },
    contact_ids: { type: [Schema.Types.ObjectId], ref: "Contact", default: [] },
  },
  // Builder JSON (Joi-validated); body_html is rendered from it on save.
  design: { type: Schema.Types.Mixed, default: null },
  scheduled_at: { type: Date, default: null },
  recurrence: { type: recurrenceSchema, default: () => ({}) },
  // What the sweep keys on; null when nothing is due.
  next_run_at: { type: Date, default: null },
  last_run_at: { type: Date, default: null },
  runs_count: { type: Number, default: 0 },
});

campaignSchema.index({ tenant_id: 1, updated_at: -1 });
campaignSchema.index({ status: 1, next_run_at: 1 });

module.exports = model("Campaign", campaignSchema);
