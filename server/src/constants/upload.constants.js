// constants/upload.constants.js
// Allowed upload MIME types: stored extension, kind and content signature.

const UPLOAD_KIND = Object.freeze({ IMAGE: "image", VIDEO: "video", FILE: "file" });

const type = (ext, kind, signature) => Object.freeze({ ext, kind, signature });

// NOTE: extension comes from this table, never from the client's filename.
const UPLOAD_TYPES = Object.freeze({
  "image/jpeg": type(".jpg", UPLOAD_KIND.IMAGE, "jpeg"),
  "image/jpg": type(".jpg", UPLOAD_KIND.IMAGE, "jpeg"),
  "image/png": type(".png", UPLOAD_KIND.IMAGE, "png"),
  "image/webp": type(".webp", UPLOAD_KIND.IMAGE, "webp"),
  "image/gif": type(".gif", UPLOAD_KIND.IMAGE, "gif"),
  "video/mp4": type(".mp4", UPLOAD_KIND.VIDEO, "isoMedia"),
  "video/quicktime": type(".mov", UPLOAD_KIND.VIDEO, "isoMedia"),
  "video/mov": type(".mov", UPLOAD_KIND.VIDEO, "isoMedia"),
  "video/webm": type(".webm", UPLOAD_KIND.VIDEO, "webm"),
  "video/x-msvideo": type(".avi", UPLOAD_KIND.VIDEO, "avi"),
  "video/avi": type(".avi", UPLOAD_KIND.VIDEO, "avi"),
  "application/pdf": type(".pdf", UPLOAD_KIND.FILE, "pdf"),
  "application/msword": type(".doc", UPLOAD_KIND.FILE, "ole"),
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": type(".docx", UPLOAD_KIND.FILE, "zip"),
  "application/zip": type(".zip", UPLOAD_KIND.FILE, "zip"),
  "application/x-zip-compressed": type(".zip", UPLOAD_KIND.FILE, "zip"),
});

// Allowlisted extensions (legacy .jpeg too) and the signature each needs.
const SIGNATURE_BY_EXTENSION = Object.freeze({
  ...Object.fromEntries(Object.values(UPLOAD_TYPES).map((t) => [t.ext, t.signature])),
  ".jpeg": "jpeg",
});

// Served inline from /uploads; everything else downloads. ".jpeg" is legacy.
const INLINE_UPLOAD_EXTENSIONS = Object.freeze(
  new Set([
    ...Object.values(UPLOAD_TYPES).filter((t) => t.kind !== UPLOAD_KIND.FILE).map((t) => t.ext),
    ".jpeg",
  ]),
);

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const MAX_UPLOAD_FILES = 20;

const UPLOAD_TYPE_ERROR =
  "File type not allowed. Allowed types: jpeg, jpg, png, webp, gif, mp4, mov, webm, avi, pdf, doc, docx, zip";

module.exports = {
  UPLOAD_KIND,
  UPLOAD_TYPES,
  SIGNATURE_BY_EXTENSION,
  INLINE_UPLOAD_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  UPLOAD_TYPE_ERROR,
};
