// controllers/campaign.controller.js

const campaignService = require("../services/campaign/campaign.service");
const contactService = require("../services/campaign/contact.service");
const templateService = require("../services/campaign/campaign-template.service");
const { getCompanyProfile } = require("../services/tenant-settings.service");
const { success, created, systemfailure } = require("../utils/http/response");
const { toPage } = require("../utils/http/handle");
const { renderSimplePage } = require("../utils/http/htmlPage");
const { CONTACT_STATUS } = require("../constants/campaign.constants");

exports.listCampaigns = async (req, res) => {
  try {
    const { limit, skip } = req.pagination;
    const { search, status, kind } = req.query;
    const result = await campaignService.listCampaigns(req.tenantId, { skip, limit, search, status, kind });
    return success(res, toPage(req.pagination, result));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getCampaign = async (req, res) => {
  try {
    return success(res, await campaignService.getCampaign(req.params.id, req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createCampaign = async (req, res) => {
  try {
    return created(res, await campaignService.createCampaign(req.tenantId, req.body), "Campaign created");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateCampaign = async (req, res) => {
  try {
    return success(res, await campaignService.updateCampaign(req.params.id, req.tenantId, req.body), "Campaign saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    return success(res, await campaignService.deleteCampaign(req.params.id, req.tenantId), "Campaign deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.duplicateCampaign = async (req, res) => {
  try {
    return created(res, await campaignService.duplicateCampaign(req.params.id, req.tenantId), "Campaign duplicated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.sendCampaign = async (req, res) => {
  try {
    return success(res, await campaignService.sendCampaignNow(req.params.id, req.tenantId), "Campaign is sending");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.scheduleCampaign = async (req, res) => {
  try {
    return success(res, await campaignService.scheduleCampaign(req.params.id, req.tenantId, req.body), "Campaign scheduled");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.pauseCampaign = async (req, res) => {
  try {
    return success(res, await campaignService.pauseCampaign(req.params.id, req.tenantId), "Campaign paused");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.sendTestEmail = async (req, res) => {
  try {
    return success(res, await campaignService.sendTestEmail(req.params.id, req.tenantId, req.body.email), "Test email queued");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.countAudience = async (req, res) => {
  try {
    return success(res, await campaignService.countCampaignAudience(req.tenantId, req.body));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.previewCampaign = async (req, res) => {
  try {
    return success(res, await campaignService.previewCampaign(req.tenantId, req.body));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.listTemplates = async (req, res) => {
  try {
    return success(res, await templateService.listTemplates(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createTemplate = async (req, res) => {
  try {
    return created(res, await templateService.createTemplate(req.tenantId, req.body), "Template saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateTemplate = async (req, res) => {
  try {
    return success(res, await templateService.updateTemplate(req.params.id, req.tenantId, req.body), "Template saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteTemplate = async (req, res) => {
  try {
    return success(res, await templateService.deleteTemplate(req.params.id, req.tenantId), "Template deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

const NOT_FOUND_PAGE = {
  title: "Link expired",
  heading: "This link isn't valid",
  message: "It may be incomplete or out of date. You can reply to any of our emails to unsubscribe.",
};

async function storeNameFor(tenantId) {
  return (await getCompanyProfile(tenantId)).company_name || "this store";
}

// GET never unsubscribes: mail scanners prefetch links in every email.
exports.unsubscribePage = async (req, res) => {
  try {
    const contact = await contactService.findContactByUnsubscribeToken(req.params.token);
    if (!contact) return res.status(404).type("html").send(renderSimplePage(NOT_FOUND_PAGE));
    const storeName = await storeNameFor(contact.tenant_id);
    if (contact.status !== CONTACT_STATUS.SUBSCRIBED) {
      const message = `${contact.email} won't receive marketing emails from ${storeName}.`;
      return res.type("html").send(renderSimplePage({ title: "Unsubscribed", heading: "You're unsubscribed", message }));
    }
    const page = {
      title: "Unsubscribe",
      heading: `Unsubscribe from ${storeName}?`,
      message: `${contact.email} will stop receiving newsletters and offers. Order emails are unaffected.`,
      form: { action: req.originalUrl, label: "Unsubscribe" },
    };
    return res.type("html").send(renderSimplePage(page));
  } catch (err) {
    return systemfailure(res, err);
  }
};

// Serves the confirm button and RFC 8058 one-click POSTs from mail clients.
exports.unsubscribe = async (req, res) => {
  try {
    const result = await contactService.unsubscribeByToken(req.params.token);
    if (!result) return res.status(404).type("html").send(renderSimplePage(NOT_FOUND_PAGE));
    const message = `${result.email} won't receive marketing emails from ${await storeNameFor(result.tenantId)} again.`;
    return res.type("html").send(renderSimplePage({ title: "Unsubscribed", heading: "You're unsubscribed", message }));
  } catch (err) {
    return systemfailure(res, err);
  }
};
