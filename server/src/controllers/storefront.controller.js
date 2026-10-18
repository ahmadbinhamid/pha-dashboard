// controllers/storefront.controller.js

const storefrontService = require("../services/storefront.service");
const { success, systemfailure } = require("../utils/http/response");

exports.getPublic = async (req, res) => {
  try {
    return success(res, await storefrontService.getPublicStorefront(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getSettings = async (req, res) => {
  try {
    return success(res, await storefrontService.getSettings(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateHeroSlides = async (req, res) => {
  try {
    const settings = await storefrontService.updateHeroSlides(req.tenantId, req.body.slides);
    return success(res, settings, "Hero slides saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateAnnouncement = async (req, res) => {
  try {
    return success(res, await storefrontService.updateAnnouncement(req.tenantId, req.body), "Announcement saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateFlashSale = async (req, res) => {
  try {
    return success(res, await storefrontService.updateFlashSale(req.tenantId, req.body), "Flash sale saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.launchFlashSale = async (req, res) => {
  try {
    return success(res, await storefrontService.launchFlashSale(req.tenantId, req.body), "Flash sale launched");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateHeroSettings = async (req, res) => {
  try {
    return success(res, await storefrontService.updateHeroSettings(req.tenantId, req.body), "Carousel settings saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};
