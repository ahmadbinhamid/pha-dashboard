// controllers/location.controller.js

const Location = require("../models/Location");
const {
  success,
  created,
  notFound,
  systemfailure,
} = require("../utils/http/response");

exports.getLocations = async (req, res) => {
  try {
    const locations = await Location.find({}).sort({ name: 1 });
    return success(res, locations);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) return notFound(res, "Location not found");
    return success(res, location);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createLocation = async (req, res) => {
  try {
    const { name, address, is_active } = req.body;
    const location = await Location.create({
      name,
      address: address || null,
      is_active: is_active !== undefined ? is_active : true,
    });
    return created(res, location, "Location created");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) return notFound(res, "Location not found");

    const { name, address, is_active } = req.body;
    if (name !== undefined) location.name = name;
    if (address !== undefined) location.address = address;
    if (is_active !== undefined) location.is_active = is_active;

    await location.save();
    return success(res, location, "Location updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteLocation = async (req, res) => {
  try {
    const location = await Location.findById(req.params.id);
    if (!location) return notFound(res, "Location not found");
    await location.softDelete();
    return success(res, null, "Location deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
