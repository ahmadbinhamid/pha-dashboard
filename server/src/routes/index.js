// routes/index.js

const router = require("express").Router();
const { success } = require("../utils/http/response");

router.get("/health", (req, res) => {
  success(res, { uptime: process.uptime() }, "OK");
});

router.use("/auth", require("./auth.routes"));
router.use("/user", require("./user.routes"));
router.use("/attachment", require("./attachment.routes"));
router.use("/category", require("./category.routes"));
router.use("/location", require("./location.routes"));
router.use("/product", require("./product.routes"));
router.use("/inventory", require("./inventory.routes"));
router.use("/ebay", require("./ebay.routes"));
router.use("/inquiry", require("./inquiry.routes"));

module.exports = router;
