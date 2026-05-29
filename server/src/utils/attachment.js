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

function getAttachmentType(mimeType) {
  return IMAGE_MIMES.includes(mimeType) ? "image" : "file";
}

function buildAttachmentUrl(fileName) {
  if (!fileName) return null;
  return `${config.uploads.url}/${fileName}`;
}

module.exports = { IMAGE_MIMES, getAttachmentType, buildAttachmentUrl };
