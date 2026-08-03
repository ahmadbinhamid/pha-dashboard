// controllers/location.controller.js

const locationService = require("../services/location.service");
const {
  success,
  created,
  notFound,
  systemfailure,
} = require("../utils/http/response");

exports.getLocations = async (req, res) => {
  try {
    const locations = await locationService.listLocations(req.tenantId);
    return success(res, locations);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getLocation = async (req, res) => {
  try {
    const location = await locationService.getLocationById(req.params.id, req.tenantId);
    if (!location) return notFound(res, "Location not found");
    return success(res, location);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createLocation = async (req, res) => {
  try {
    const location = await locationService.createLocation(req.body, req.tenantId);
    return created(res, location, "Location created");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const location = await locationService.updateLocation(req.params.id, req.body, req.tenantId);
    if (!location) return notFound(res, "Location not found");
    return success(res, location, "Location updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const location = await locationService.deleteLocation(req.params.id, req.tenantId);
    if (!location) return notFound(res, "Location not found");
    return success(res, null, "Location deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
