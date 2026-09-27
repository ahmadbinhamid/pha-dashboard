// utils/attachment.js

const path = require("path");
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

// Absolute on-disk path for an uploaded file; workers share this volume with the API, so it's
// also safe to hand straight to nodemailer as an attachment `path`.
function buildAttachmentFilePath(fileName) {
  if (!fileName) return null;
  return path.join(config.uploads.dir, fileName);
}

// `url` is a Mongoose virtual, only computed when a full document is serialized; a .lean()
// query or $lookup returns a plain object where it's silently missing, so backfill it explicitly.
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
  buildAttachmentFilePath,
  withAttachmentUrl,
  withAttachmentUrls,
};
