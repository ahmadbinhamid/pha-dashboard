// models/CampaignRun.js
// One send of a campaign, with live delivery counters.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const { RUN_STATUS } = require("../constants/campaign.constants");

const campaignRunSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    campaign_id: { type: Schema.Types.ObjectId, ref: "Campaign", required: true },
    status: { type: String, enum: Object.values(RUN_STATUS), default: RUN_STATUS.QUEUED },
    // Content is frozen per run, so editing mid-send can't mix two versions.
    subject: { type: String, required: true },
    preheader: { type: String, default: "" },
    body_html: { type: String, required: true },
    // The design's page colours and width, so the wrapper matches the body.
    layout: { type: Schema.Types.Mixed, default: null },
    // Known only once fan-out has walked the audience.
    total: { type: Number, default: 0 },
    fanout_done: { type: Boolean, default: false },
    sent: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    started_at: { type: Date, default: Date.now },
    finished_at: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { softDelete: false },
);

campaignRunSchema.index({ tenant_id: 1, campaign_id: 1, started_at: -1 });

module.exports = model("CampaignRun", campaignRunSchema);
