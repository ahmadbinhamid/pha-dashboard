// controllers/tag.controller.js

const tagService = require("../services/tag.service");
const { success, created, notFound, systemfailure } = require("../utils/http/response");

exports.getQueue = async (req, res) => {
  try {
    return success(res, await tagService.listQueue(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.addToQueue = async (req, res) => {
  try {
    const item = await tagService.addToQueue(req.tenantId, req.user?._id, req.body);
    return created(res, item, "Added to tag queue");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateQueueItem = async (req, res) => {
  try {
    const item = await tagService.updateQueueItem(req.tenantId, req.params.id, req.body);
    if (!item) return notFound(res, "Queue item not found");
    return success(res, item, "Queue updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.removeQueueItem = async (req, res) => {
  try {
    const removed = await tagService.removeQueueItem(req.tenantId, req.params.id);
    if (!removed) return notFound(res, "Queue item not found");
    return success(res, null, "Removed from tag queue");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.clearQueue = async (req, res) => {
  try {
    const removed = await tagService.clearQueue(req.tenantId);
    return success(res, { removed }, "Tag queue cleared");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.importUnprinted = async (req, res) => {
  try {
    const result = await tagService.importUnprinted(req.tenantId, req.user?._id);
    return success(res, result, `Queued ${result.added} product(s) never printed`);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.recordPrint = async (req, res) => {
  try {
    const log = await tagService.recordPrint(req.tenantId, req.user?._id, req.body);
    return created(res, log, "Print recorded");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getHistory = async (req, res) => {
  try {
    return success(res, await tagService.listHistory(req.tenantId, req.pagination));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getStyle = async (req, res) => {
  try {
    return success(res, await tagService.getStyle(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateStyle = async (req, res) => {
  try {
    return success(res, await tagService.updateStyle(req.tenantId, req.body), "Tag style saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};
