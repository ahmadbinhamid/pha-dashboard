// routes/index.js

const router = require("express").Router();

router.get("/health", (req, res) => {
  res.status(200).json({
    status: "Success",
    message: "OK",
    data: { uptime: process.uptime() },
  });
});

router.use("/auth", require("./auth.routes"));
router.use("/user", require("./user.routes"));
router.use("/attachment", require("./attachment.routes"));
router.use("/category", require("./category.routes"));
router.use("/location", require("./location.routes"));
router.use("/product", require("./product.routes"));
router.use("/inventory", require("./inventory.routes"));

module.exports = router;
