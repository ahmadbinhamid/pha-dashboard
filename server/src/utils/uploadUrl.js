// utils/uploadUrl.js
// Image fields store only our upload's file name; UPLOADS_URL adds the host.

const { buildAttachmentUrl } = require("./attachment");

// upload.js names every file <uuid><ext>; anything else is an external link.
const UUID_FILE = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[a-z0-9]+";
const UPLOAD_FILE = new RegExp(`^${UUID_FILE}$`, "i");
const UPLOAD_URL = new RegExp(`/uploads/(${UUID_FILE})(?:[?#].*)?$`, "i");
// Our upload links inside HTML, with any host or none (a saved relative link).
const HTML_ABSOLUTE_LINK = new RegExp(`https?://[^\\s"'()<>]+?/uploads/(${UUID_FILE})`, "gi");
const HTML_ANY_LINK = new RegExp(`(?:https?://[^\\s"'()<>]+?)?/uploads/(${UUID_FILE})`, "gi");

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

/** For saving HTML: our upload links drop their host, the text is untouched. */
function toRelativeUploadLinks(html) {
  return html ? html.replace(HTML_ABSOLUTE_LINK, "/uploads/$1") : html;
}

/** For publishing HTML: our upload links point at today's UPLOADS_URL. */
function toAbsoluteUploadLinks(html) {
  return html ? html.replace(HTML_ANY_LINK, (_match, file) => buildAttachmentUrl(file)) : html;
}

module.exports = { toUploadRef, toUploadUrl, toRelativeUploadLinks, toAbsoluteUploadLinks };
