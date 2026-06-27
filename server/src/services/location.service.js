// services/location.service.js

const Location = require("../models/Location");

async function listLocations() {
  return Location.find({}).sort({ name: 1 });
}

async function getLocationById(id) {
  return Location.findById(id);
}

async function createLocation({ name, address, is_active }) {
  return Location.create({
    name,
    address: address || null,
    is_active: is_active !== undefined ? is_active : true,
  });
}

async function updateLocation(id, { name, address, is_active }) {
  const location = await Location.findById(id);
  if (!location) return null;

  if (name !== undefined) location.name = name;
  if (address !== undefined) location.address = address;
  if (is_active !== undefined) location.is_active = is_active;

  await location.save();
  return location;
}

async function deleteLocation(id) {
  const location = await Location.findById(id);
  if (!location) return null;
  await location.softDelete();
  return location;
}

module.exports = { listLocations, getLocationById, createLocation, updateLocation, deleteLocation };
