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

module.exports = router;
