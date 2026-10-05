// utils/attachment.js
// Attachment URLs, disk paths and kinds.

const path = require("path");
const config = require("../config");
const { UPLOAD_TYPES, UPLOAD_KIND } = require("../constants/upload.constants");

const IMAGE_MIMES = Object.keys(UPLOAD_TYPES).filter((m) => UPLOAD_TYPES[m].kind === UPLOAD_KIND.IMAGE);

function getAttachmentType(mimeType) {
  return UPLOAD_TYPES[mimeType]?.kind ?? UPLOAD_KIND.FILE;
}

function buildAttachmentUrl(fileName) {
  if (!fileName) return null;
  return `${config.uploads.url}/${fileName}`;
}

// Workers share the uploads volume, so this path also suits nodemailer.
function buildAttachmentFilePath(fileName) {
  if (!fileName) return null;
  return path.join(config.uploads.dir, fileName);
}

// `url` is a virtual, missing on .lean()/$lookup results, so fill it in.
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
