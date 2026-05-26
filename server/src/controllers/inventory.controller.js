// controllers/inventory.controller.js

const Inventory = require("../models/Inventory");
const InventoryHistory = require("../models/InventoryHistory");
const InventorySettings = require("../models/InventorySettings");
const {
  listInventory,
  getSkuForRecord,
  syncInventoryToEbay,
} = require("../services/inventory.service");
const {
  success,
  notFound,
  badRequest,
  systemfailure,
} = require("../utils/http/response");

async function fetchPopulatedRecord(id) {
  return Inventory.findById(id)
    .populate("product", "title slug attachments")
    .populate("variant", "display_name sku combination")
    .populate("location", "name address");
}

exports.getInventory = async (req, res) => {
  try {
    const { page, limit } = req.pagination;

    const result = await listInventory({
      page,
      limit,
      search: req.query.search || undefined,
      location: req.query.location || undefined,
    });

    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.adjustStock = async (req, res) => {
  try {
    const record = await Inventory.findById(req.params.inventoryId);
    if (!record) return notFound(res, "Inventory record not found");

    const { adjustment, reason, type } = req.body;

    if (adjustment === undefined || isNaN(Number(adjustment))) {
      return badRequest(res, "Adjustment value is required");
    }

    const adj = Number(adjustment);
    const stock_before = record.stock_count;
    const stock_after = Math.max(0, stock_before + adj);

    record.stock_count = stock_after;
    await record.save();

    await InventoryHistory.create({
      inventory: record._id,
      product: record.product,
      variant: record.variant,
      location: record.location,
      adjustment: adj,
      stock_before,
      stock_after,
      reason: reason || null,
      type: type || "other",
      user: req.user?._id || null,
    });

    const sku = await getSkuForRecord(record);
    if (sku) await syncInventoryToEbay(sku, stock_after);

    return success(
      res,
      await fetchPopulatedRecord(record._id),
      "Stock adjusted",
    );
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.setStock = async (req, res) => {
  try {
    const record = await Inventory.findById(req.params.inventoryId);
    if (!record) return notFound(res, "Inventory record not found");

    const { stock_count, reason } = req.body;

    if (
      stock_count === undefined ||
      isNaN(Number(stock_count)) ||
      Number(stock_count) < 0
    ) {
      return badRequest(res, "stock_count must be a non-negative number");
    }

    const newCount = Math.round(Number(stock_count));
    const stock_before = record.stock_count;

    record.stock_count = newCount;
    await record.save();

    await InventoryHistory.create({
      inventory: record._id,
      product: record.product,
      variant: record.variant,
      location: record.location,
      adjustment: newCount - stock_before,
      stock_before,
      stock_after: newCount,
      reason: reason || null,
      type: "correction",
      user: req.user?._id || null,
    });

    const sku = await getSkuForRecord(record);
    if (sku) await syncInventoryToEbay(sku, newCount);

    return success(res, await fetchPopulatedRecord(record._id), "Stock set");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getHistory = async (req, res) => {
  try {
    const record = await Inventory.findById(req.params.inventoryId);
    if (!record) return notFound(res, "Inventory record not found");

    const history = await InventoryHistory.find({ inventory: record._id })
      .populate("user", "first_name last_name email")
      .populate("location", "name")
      .sort({ created_at: -1 })
      .limit(100);

    return success(res, history);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await InventorySettings.getOrCreate();
    return success(res, settings);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await InventorySettings.getOrCreate();
    const {
      low_stock_threshold,
      email_notifications,
      notification_email,
      notification_send_time,
    } = req.body;

    if (low_stock_threshold !== undefined)
      settings.low_stock_threshold = low_stock_threshold;
    if (email_notifications !== undefined)
      settings.email_notifications = email_notifications;
    if (notification_email !== undefined)
      settings.notification_email = notification_email || null;
    if (notification_send_time !== undefined)
      settings.notification_send_time = notification_send_time;

    await settings.save();
    return success(res, settings, "Settings updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};
