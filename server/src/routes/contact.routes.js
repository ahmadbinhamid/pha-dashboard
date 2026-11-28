// routes/contact.routes.js
// Campaign contacts, mounted under /campaigns/contacts.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const pagination = require("../middlewares/pagination");
const validate = require("../middlewares/validate");
const { uploadSpreadsheet } = require("../middlewares/upload");
const v = require("../validators/contact.validation");
const ctrl = require("../controllers/contact.controller");

const canView = requirePermission("campaigns.view");

router.get("/", auth(), canView, validate(v.listContacts), pagination({ defaultLimit: 25 }), asyncHandler(ctrl.listContacts));
router.get("/stats", auth(), canView, asyncHandler(ctrl.getContactStats));
router.get("/lists", auth(), canView, asyncHandler(ctrl.listContactLists));
router.get("/select-ids", auth(), canView, validate(v.selectContactIds), asyncHandler(ctrl.selectContactIds));
router.post("/lists/rename", auth(), requirePermission("campaigns.update"), validate(v.renameList), asyncHandler(ctrl.renameList));
router.post("/lists/delete", auth(), requirePermission("campaigns.update"), validate(v.deleteList), asyncHandler(ctrl.deleteList));
router.get("/export", auth(), requirePermission("campaigns.export"), validate(v.exportContacts), asyncHandler(ctrl.exportContacts));
router.post(
  "/import",
  auth(),
  requirePermission("campaigns.create"),
  ...uploadSpreadsheet("file"),
  validate(v.importContacts),
  asyncHandler(ctrl.importContacts),
);
router.post("/bulk-lists", auth(), requirePermission("campaigns.update"), validate(v.bulkLists), asyncHandler(ctrl.bulkUpdateLists));
router.post("/", auth(), requirePermission("campaigns.create"), validate(v.createContact), asyncHandler(ctrl.createContact));
router.patch("/:id", auth(), requirePermission("campaigns.update"), validate(v.updateContact), asyncHandler(ctrl.updateContact));
router.delete("/:id", auth(), requirePermission("campaigns.delete"), validate(v.byIdParam), asyncHandler(ctrl.deleteContact));

module.exports = router;
