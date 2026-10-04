// middlewares/uploadHeaders.js
// /uploads holds user content on our own origin, so it never runs as a page.

const path = require("path");
const { INLINE_UPLOAD_EXTENSIONS } = require("../constants/upload.constants");

// NOTE: images/videos stay inline for the dashboard, eBay and Google.
function uploadHeaders(req, res, next) {
  // Cross-origin CORP so the FE on another port can load media.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!INLINE_UPLOAD_EXTENSIONS.has(path.extname(req.path).toLowerCase())) {
    res.setHeader("Content-Disposition", "attachment");
  }
  next();
}

module.exports = uploadHeaders;
