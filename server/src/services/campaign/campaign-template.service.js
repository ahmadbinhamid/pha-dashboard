// services/campaign/campaign-template.service.js
// Saved email designs that new campaigns can start from.

const CampaignTemplate = require("../../models/CampaignTemplate");
const { httpError } = require("../../utils/http/httpError");
const { MAX_TEMPLATES } = require("../../constants/campaign.constants");

async function listTemplates(tenantId) {
  return CampaignTemplate.find({ tenant_id: tenantId }).sort({ updated_at: -1 }).limit(MAX_TEMPLATES).lean();
}

async function createTemplate(tenantId, { name, design }) {
  if ((await CampaignTemplate.countDocuments({ tenant_id: tenantId })) >= MAX_TEMPLATES) {
    throw httpError(`You can keep up to ${MAX_TEMPLATES} templates; delete one first`, 409);
  }
  const created = await CampaignTemplate.create({ tenant_id: tenantId, name, design });
  return created.toObject();
}

async function updateTemplate(id, tenantId, patch) {
  const updated = await CampaignTemplate.findOneAndUpdate(
    { _id: id, tenant_id: tenantId },
    { $set: patch },
    { new: true, runValidators: true },
  ).lean();
  if (!updated) throw httpError("Template not found", 404);
  return updated;
}

async function deleteTemplate(id, tenantId) {
  const { deletedCount } = await CampaignTemplate.deleteOne({ _id: id, tenant_id: tenantId });
  if (!deletedCount) throw httpError("Template not found", 404);
  return { _id: id };
}

module.exports = { listTemplates, createTemplate, updateTemplate, deleteTemplate };
