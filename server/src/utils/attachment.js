// utils/attachment.js

const config = require("../config");

/** MIME types we treat as images */
const IMAGE_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];

const VIDEO_MIMES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/avi",
  "video/mov",
];

function getAttachmentType(mimeType) {
  if (IMAGE_MIMES.includes(mimeType)) return "image";
  if (VIDEO_MIMES.includes(mimeType)) return "video";
  return "file";
}

function buildAttachmentUrl(fileName) {
  if (!fileName) return null;
  return `${config.uploads.url}/${fileName}`;
}

// `url` is a Mongoose virtual on the Attachment model (derived from
// file_name) — it's only computed automatically when a full Mongoose
// document is serialized. Anywhere attachments come back as plain objects
// instead (aggregation $lookup, or a query using .lean()), the virtual never
// runs and `url` is silently missing. Use this to backfill it explicitly.
function withAttachmentUrl(attachment) {
  if (!attachment) return attachment;
  return { ...attachment, url: attachment.url ?? buildAttachmentUrl(attachment.file_name) };
}

function withAttachmentUrls(attachments) {
  return (attachments || []).map(withAttachmentUrl);
}

module.exports = {
  IMAGE_MIMES,
  getAttachmentType,
  buildAttachmentUrl,
  withAttachmentUrl,
  withAttachmentUrls,
};
