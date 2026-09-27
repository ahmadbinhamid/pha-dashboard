// controllers/channel.controller.js

const registry = require("../services/marketplace/registry");
const channelService = require("../services/marketplace/channel.service");
const mongoose = require("mongoose");
const { success, notFound, badRequest, systemfailure } = require("../utils/http/response");
const { CHANNEL_SYNC_LOG_STATUS } = require("../constants/channel.constants");

exports.listChannels = async (req, res) => {
  try {
    const channels = await channelService.listChannelsForTenant(req.tenantId);
    return success(res, channels);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getLogs = async (req, res) => {
  try {
    const { platform } = req.params;
    if (!registry.has(platform)) return notFound(res, `Unknown platform: ${platform}`);

    const { entity_id: entityId, status } = req.query;
    if (entityId && !mongoose.isValidObjectId(entityId)) return badRequest(res, "entity_id must be an ObjectId");
    if (status && !Object.values(CHANNEL_SYNC_LOG_STATUS).includes(status)) return badRequest(res, "Unknown log status");

    const { page, limit } = req.pagination;
    const result = await channelService.getChannelLogs(req.tenantId, platform, { page, limit, entityId, status });
    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.retryLog = async (req, res) => {
  try {
    const { platform, logId } = req.params;
    if (!registry.has(platform)) return notFound(res, `Unknown platform: ${platform}`);

    const result = await channelService.retryChannelLog(req.tenantId, platform, logId);
    if (!result) return notFound(res, "Log entry not found");
    return success(res, result, "Retry enqueued");
  } catch (err) {
    return systemfailure(res, err);
  }
};
