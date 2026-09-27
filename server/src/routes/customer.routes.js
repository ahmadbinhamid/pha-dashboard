// routes/customer.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, requirePermission } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/customer.validation");
const ctrl = require("../controllers/customer.controller");

// Customer records are PII: members of the organisation only.
router.use(auth());

router.get("/", requirePermission("customers.view"), pagination(), validate(v.listCustomers), asyncHandler(ctrl.getCustomers));
// Before "/:id", which would otherwise read "stats" as a customer id.
router.get("/stats", requirePermission("customers.view"), asyncHandler(ctrl.getStats));
router.get("/:id", requirePermission("customers.view"), validate(v.byIdParam), asyncHandler(ctrl.getCustomer));
router.post("/", requirePermission("customers.create"), validate(v.createCustomer), asyncHandler(ctrl.createCustomer));
router.put("/:id", requirePermission("customers.update"), validate({ ...v.byIdParam, ...v.updateCustomer }), asyncHandler(ctrl.updateCustomer));
router.delete("/:id", requirePermission("customers.delete"), validate(v.byIdParam), asyncHandler(ctrl.deleteCustomer));

module.exports = router;
