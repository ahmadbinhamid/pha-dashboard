// models/CampaignTemplate.js
// A saved email design staff can start new campaigns from.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");

const campaignTemplateSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    name: { type: String, required: true, trim: true },
    // Same builder JSON as Campaign.design, validated by the same schema.
    design: { type: Schema.Types.Mixed, required: true },
  },
  { softDelete: false },
);

campaignTemplateSchema.index({ tenant_id: 1, updated_at: -1 });

module.exports = model("CampaignTemplate", campaignTemplateSchema);
