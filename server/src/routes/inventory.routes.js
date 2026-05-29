// routes/inventory.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/inventory.validation");
const ctrl = require("../controllers/inventory.controller");

// All routes require authentication
router.use(auth());

// Settings routes — must come BEFORE /:inventoryId to avoid route conflict
router.get("/settings", asyncHandler(ctrl.getSettings));
router.put(
  "/settings",
  validate(v.updateSettings),
  asyncHandler(ctrl.updateSettings),
);

// Inventory list
router.get(
  "/",
  pagination(),
  validate(v.listInventory),
  asyncHandler(ctrl.getInventory),
);

// Ensure (upsert) an inventory record for a product+location
router.post(
  "/ensure",
  validate(v.ensureRecord),
  asyncHandler(ctrl.ensureRecord),
);

// Stock adjustments
router.post(
  "/:inventoryId/adjust",
  validate(v.adjustStock),
  asyncHandler(ctrl.adjustStock),
);
router.post(
  "/:inventoryId/set",
  validate(v.setStock),
  asyncHandler(ctrl.setStock),
);

// History
router.get("/:inventoryId/history", asyncHandler(ctrl.getHistory));

module.exports = router;
