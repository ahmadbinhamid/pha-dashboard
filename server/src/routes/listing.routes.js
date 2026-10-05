// routes/listing.routes.js
// Generic listing CRUD; create/update pick the platform's schema and writer.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/listing.validation");
const { validateListingCreate, validateListingUpdate } = require("../middlewares/validateListing");
const ctrl = require("../controllers/listing.controller");

router.post("/", auth(), requirePermission("listings.create"), validateListingCreate, asyncHandler(ctrl.createListing));
router.get("/", auth(), requirePermission("listings.view"), pagination(), validate(v.listListings), asyncHandler(ctrl.getListings));
router.get("/:id", auth(), requirePermission("listings.view"), asyncHandler(ctrl.getListing));
router.put("/:id", auth(), requirePermission("listings.update"), validateListingUpdate, asyncHandler(ctrl.updateListing));
router.delete("/:id", auth(), requirePermission("listings.delete"), asyncHandler(ctrl.deleteListing));
router.post("/:id/push", auth(), requirePermission("listings.update"), asyncHandler(ctrl.pushListing));

module.exports = router;
