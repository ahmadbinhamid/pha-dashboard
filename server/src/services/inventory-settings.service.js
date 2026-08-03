// services/inventory-settings.service.js

const InventorySettings = require("../models/InventorySettings");

async function getSettings(tenantId) {
  return InventorySettings.getOrCreate(tenantId);
}

async function updateSettings(settings, { low_stock_threshold, email_notifications, notification_email, notification_send_time }) {
  if (low_stock_threshold !== undefined) settings.low_stock_threshold = low_stock_threshold;
  if (email_notifications !== undefined) settings.email_notifications = email_notifications;
  if (notification_email !== undefined) settings.notification_email = notification_email || null;
  if (notification_send_time !== undefined) settings.notification_send_time = notification_send_time;
  await settings.save();
  return settings;
}

module.exports = { getSettings, updateSettings };
