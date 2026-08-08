// controllers/domain.controller.js

const domainService = require("../services/domain.service");
const { success, created, notFound, systemfailure } = require("../utils/http/response");

exports.getDomains = async (req, res) => {
  try {
    const domains = await domainService.listDomains(req.tenantId);
    return success(res, domains);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createDomain = async (req, res) => {
  try {
    const domain = await domainService.createDomain(req.body.hostname, req.tenantId);
    return created(res, domain, "Domain added — add the DNS record shown to verify it");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteDomain = async (req, res) => {
  try {
    const domain = await domainService.deleteDomain(req.params.id, req.tenantId);
    if (!domain) return notFound(res, "Domain not found");
    return success(res, null, "Domain removed");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.setDefaultDomain = async (req, res) => {
  try {
    const domain = await domainService.setDefaultDomain(req.params.id, req.tenantId);
    if (!domain) return notFound(res, "Domain not found");
    return success(res, domain, "Default domain updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.verifyDomain = async (req, res) => {
  try {
    const result = await domainService.verifyDomainDns(req.params.id, req.tenantId);
    if (!result) return notFound(res, "Domain not found");
    return success(
      res,
      result,
      result.verified ? "Domain verified" : "TXT record not found yet — DNS changes can take a while to propagate",
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};
