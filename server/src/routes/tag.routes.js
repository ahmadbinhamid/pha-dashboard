// routes/tag.routes.js
// Tag manager: print queue, print history and tag style (staff).

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/tag.validation");
const ctrl = require("../controllers/tag.controller");

router.use(auth());

router.get("/queue", asyncHandler(ctrl.getQueue));
router.post("/queue", validate(v.addToQueue), asyncHandler(ctrl.addToQueue));
router.delete("/queue", asyncHandler(ctrl.clearQueue));
router.post("/queue/import-unprinted", asyncHandler(ctrl.importUnprinted));
router.patch("/queue/:id", validate(v.updateQueueItem), asyncHandler(ctrl.updateQueueItem));
router.delete("/queue/:id", validate(v.idParams), asyncHandler(ctrl.removeQueueItem));

router.get("/history", pagination({ defaultLimit: 20 }), asyncHandler(ctrl.getHistory));
router.post("/prints", validate(v.recordPrint), asyncHandler(ctrl.recordPrint));

router.get("/style", asyncHandler(ctrl.getStyle));
router.put("/style", validate(v.updateStyle), asyncHandler(ctrl.updateStyle));

module.exports = router;
