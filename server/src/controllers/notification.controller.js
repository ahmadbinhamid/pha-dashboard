// controllers/notification.controller.js

const notificationService = require("../services/notification.service");
const { success, notFound, systemfailure } = require("../utils/http/response");

exports.listNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;
    const result = await notificationService.listNotifications(req.user._id, req.tenantId, {
      page,
      limit,
      skip,
      category: req.query.category,
    });
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user._id);
    return success(res, null);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user._id, req.tenantId, { category: req.query.category });
    return success(res, null);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getPreferences = async (req, res) => {
  try {
    const preferences = await notificationService.getNotificationPreferences(req.user._id);
    if (!preferences) return notFound(res, "User not found");
    return success(res, preferences);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const preferences = await notificationService.updateNotificationPreferences(req.user._id, req.body);
    if (!preferences) return notFound(res, "User not found");
    return success(res, preferences, "Notification settings saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};
