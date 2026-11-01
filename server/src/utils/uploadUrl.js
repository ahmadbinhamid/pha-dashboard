// utils/uploadUrl.js
// Image fields store only our upload's file name; UPLOADS_URL adds the host.

const { buildAttachmentUrl } = require("./attachment");

// upload.js names every file <uuid><ext>; anything else is an external link.
const UPLOAD_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;
const UPLOAD_URL = /\/uploads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+)(?:[?#].*)?$/i;

/** For saving: our upload's URL, on any host, becomes its bare file name. */
function toUploadRef(value) {
  if (!value) return value;
  const match = String(value).trim().match(UPLOAD_URL);
  return match ? match[1] : value;
}

/** For reading: a stored ref (or a legacy full URL) on today's UPLOADS_URL. */
function toUploadUrl(value) {
  if (!value) return value ?? null;
  const ref = toUploadRef(value);
  return UPLOAD_FILE.test(ref) ? buildAttachmentUrl(ref) : ref;
}

module.exports = { toUploadRef, toUploadUrl };
