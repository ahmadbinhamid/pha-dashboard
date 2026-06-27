// controllers/inventory.controller.js

const {
  listInventory,
  fanOutMarketplaceInventory,
  fetchPopulatedRecord,
  findRecord,
  ensureRecord,
  adjustStock,
  setStock,
  getHistory,
} = require("../services/inventory.service");
const { getSettings, updateSettings } = require("../services/inventory-settings.service");
const {
  success,
  created,
  notFound,
  badRequest,
  systemfailure,
} = require("../utils/http/response");

exports.getInventory = async (req, res) => {
  try {
    const { page, limit } = req.pagination;

    const result = await listInventory({
      page,
      limit,
      search: req.query.search || undefined,
      location: req.query.location || undefined,
      product: req.query.product || undefined,
      variant: req.query.variant || undefined,
    });

    return success(res, result);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.ensureRecord = async (req, res) => {
  try {
    const { product, location, variant } = req.body;

    const record = await ensureRecord({ product, location, variant });
    return success(res, await fetchPopulatedRecord(record._id), "Inventory record ensured");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.adjustStock = async (req, res) => {
  try {
    const { adjustment, reason, type } = req.body;

    if (adjustment === undefined || isNaN(Number(adjustment))) {
      return badRequest(res, "Adjustment value is required");
    }

    const record = await findRecord(req.params.inventoryId);
    if (!record) return notFound(res, "Inventory record not found");

    await adjustStock(record, {
      adjustment: Number(adjustment),
      reason,
      type,
      userId: req.user?._id,
    });

    await fanOutMarketplaceInventory(record.product, record.variant);

    return success(res, await fetchPopulatedRecord(record._id), "Stock adjusted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.setStock = async (req, res) => {
  try {
    const { stock_count, reason } = req.body;

    if (
      stock_count === undefined ||
      isNaN(Number(stock_count)) ||
      Number(stock_count) < 0
    ) {
      return badRequest(res, "stock_count must be a non-negative number");
    }

    const record = await findRecord(req.params.inventoryId);
    if (!record) return notFound(res, "Inventory record not found");

    await setStock(record, {
      stock_count,
      reason,
      userId: req.user?._id,
    });

    await fanOutMarketplaceInventory(record.product, record.variant);

    return success(res, await fetchPopulatedRecord(record._id), "Stock set");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getHistory = async (req, res) => {
  try {
    const record = await findRecord(req.params.inventoryId);
    if (!record) return notFound(res, "Inventory record not found");

    const history = await getHistory(record._id);
    return success(res, history);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getSettings = async (req, res) => {
  try {
    const settings = await getSettings();
    return success(res, settings);
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const settings = await getSettings();
    const updated = await updateSettings(settings, req.body);
    return success(res, updated, "Settings updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};
