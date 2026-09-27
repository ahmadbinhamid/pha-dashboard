// routes/listing.routes.js
// Generic listing read/delete/push; create and eBay's PUT differ per platform.

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/listing.validation");
const ctrl = require("../controllers/listing.controller");

router.get("/", auth(), requirePermission("listings.view"), pagination(), validate(v.listListings), asyncHandler(ctrl.getListings));
router.get("/:id", auth(), requirePermission("listings.view"), asyncHandler(ctrl.getListing));
router.delete("/:id", auth(), requirePermission("listings.delete"), asyncHandler(ctrl.deleteListing));
router.post("/:id/push", auth(), requirePermission("listings.update"), asyncHandler(ctrl.pushListing));

module.exports = router;
