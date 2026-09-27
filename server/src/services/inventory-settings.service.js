// services/inventory-settings.service.js

const InventorySettings = require("../models/InventorySettings");

async function getSettings(tenantId) {
  return InventorySettings.getOrCreate(tenantId);
}

// Fields copied as-is when present in the update.
const DIRECT_FIELDS = [
  "low_stock_threshold",
  "email_notifications",
  "notification_send_time",
  "notification_frequency",
  "notification_weekday",
  "notification_month_day",
];

async function updateSettings(settings, patch) {
  for (const field of DIRECT_FIELDS) if (patch[field] !== undefined) settings[field] = patch[field];
  if (patch.notification_email !== undefined) settings.notification_email = patch.notification_email || null;
  await settings.save();
  return settings;
}

module.exports = { getSettings, updateSettings };
