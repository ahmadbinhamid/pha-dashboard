// routes/tag.routes.js
// Tag manager: print queue, print history and tag style (staff).

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/tag.validation");
const ctrl = require("../controllers/tag.controller");

router.use(auth());

router.get("/queue", requirePermission("tags.view"), asyncHandler(ctrl.getQueue));
router.post("/queue", requirePermission("tags.update"), validate(v.addToQueue), asyncHandler(ctrl.addToQueue));
router.delete("/queue", requirePermission("tags.update"), asyncHandler(ctrl.clearQueue));
router.post("/queue/import-unprinted", requirePermission("tags.update"), asyncHandler(ctrl.importUnprinted));
router.patch("/queue/:id", requirePermission("tags.update"), validate(v.updateQueueItem), asyncHandler(ctrl.updateQueueItem));
router.delete("/queue/:id", requirePermission("tags.update"), validate(v.idParams), asyncHandler(ctrl.removeQueueItem));

router.get("/history", requirePermission("tags.view"), pagination({ defaultLimit: 20 }), asyncHandler(ctrl.getHistory));
router.post("/prints", requirePermission("tags.print"), validate(v.recordPrint), asyncHandler(ctrl.recordPrint));

router.get("/style", requirePermission("tags.view"), asyncHandler(ctrl.getStyle));
router.put("/style", requirePermission("tags.update"), validate(v.updateStyle), asyncHandler(ctrl.updateStyle));

module.exports = router;
