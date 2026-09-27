// routes/inventory.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/inventory.validation");
const ctrl = require("../controllers/inventory.controller");
const reconciliationValidation = require("../validators/pendingReconciliation.validation");
const reconciliationCtrl = require("../controllers/pendingReconciliation.controller");

// All routes require authentication
router.use(auth());

// Settings routes — must come BEFORE /:inventoryId to avoid route conflict
router.get("/settings", requirePermission("inventory.view"), asyncHandler(ctrl.getSettings));
router.put(
  "/settings", requirePermission("inventory.update"),
  validate(v.updateSettings),
  asyncHandler(ctrl.updateSettings),
);

router.get("/stats", requirePermission("inventory.view"), asyncHandler(ctrl.getStats));

// Inventory list
router.get(
  "/", requirePermission("inventory.view"),
  pagination(),
  validate(v.listInventory),
  asyncHandler(ctrl.getInventory),
);

// Ensure (upsert) an inventory record for a product+location
router.post(
  "/ensure", requirePermission("inventory.update"),
  validate(v.ensureRecord),
  asyncHandler(ctrl.ensureRecord),
);

// Stock adjustments
router.post(
  "/:inventoryId/adjust", requirePermission("inventory.update"),
  validate(v.adjustStock),
  asyncHandler(ctrl.adjustStock),
);
router.post(
  "/:inventoryId/set", requirePermission("inventory.update"),
  validate(v.setStock),
  asyncHandler(ctrl.setStock),
);

// History
router.get("/:inventoryId/history", requirePermission("inventory.view"), asyncHandler(ctrl.getHistory));

// eBay quantity drift found by the poller; never auto-applied.
router.get("/reconciliations", requirePermission("inventory.view"), asyncHandler(reconciliationCtrl.getReconciliations));
router.post(
  "/reconciliations/:id/accept", requirePermission("inventory.update"),
  validate(reconciliationValidation.resolveReconciliation),
  asyncHandler(reconciliationCtrl.acceptReconciliation),
);
router.post(
  "/reconciliations/:id/reject", requirePermission("inventory.update"),
  validate(reconciliationValidation.resolveReconciliation),
  asyncHandler(reconciliationCtrl.rejectReconciliation),
);

module.exports = router;
