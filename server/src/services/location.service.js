// services/location.service.js

const Location = require("../models/Location");

async function listLocations(tenantId) {
  return Location.find({ tenant_id: tenantId }).sort({ name: 1 });
}

async function getLocationById(id, tenantId) {
  return Location.findOne({ _id: id, tenant_id: tenantId });
}

async function createLocation({ name, address, is_active }, tenantId) {
  return Location.create({
    tenant_id: tenantId,
    name,
    address: address || null,
    is_active: is_active !== undefined ? is_active : true,
  });
}

async function updateLocation(id, { name, address, is_active }, tenantId) {
  const location = await Location.findOne({ _id: id, tenant_id: tenantId });
  if (!location) return null;

  if (name !== undefined) location.name = name;
  if (address !== undefined) location.address = address;
  if (is_active !== undefined) location.is_active = is_active;

  await location.save();
  return location;
}

async function deleteLocation(id, tenantId) {
  const location = await Location.findOne({ _id: id, tenant_id: tenantId });
  if (!location) return null;
  await location.softDelete();
  return location;
}

module.exports = { listLocations, getLocationById, createLocation, updateLocation, deleteLocation };
