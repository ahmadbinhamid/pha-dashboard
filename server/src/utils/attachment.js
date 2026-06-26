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

module.exports = { IMAGE_MIMES, getAttachmentType, buildAttachmentUrl };
