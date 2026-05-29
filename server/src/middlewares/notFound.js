// middlewares/notFound.js

const { notFound } = require("../utils/http/response");

module.exports = (req, res) => {
  notFound(res, `Route not found: ${req.method} ${req.originalUrl}`);
};
