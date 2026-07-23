// routes/customer.routes.js

const router = require("express").Router();
const asyncHandler = require("../middlewares/asyncHandler");
const { auth, admin } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const pagination = require("../middlewares/pagination");
const v = require("../validators/customer.validation");
const ctrl = require("../controllers/customer.controller");

// Customer records are PII — every route here requires an authenticated admin.
router.use(auth(), admin);

router.get("/", pagination(), validate(v.listCustomers), asyncHandler(ctrl.getCustomers));
router.get("/:id", validate(v.byIdParam), asyncHandler(ctrl.getCustomer));
router.post("/", validate(v.createCustomer), asyncHandler(ctrl.createCustomer));
router.put("/:id", validate({ ...v.byIdParam, ...v.updateCustomer }), asyncHandler(ctrl.updateCustomer));
router.delete("/:id", validate(v.byIdParam), asyncHandler(ctrl.deleteCustomer));

module.exports = router;
