// utils/emailHtml.js
// Sanitises staff-authored campaign HTML and fills per-recipient merge tags.

const sanitizeHtml = require("sanitize-html");
const { MERGE_TAGS } = require("../constants/campaign.constants");

const ALLOWED_TAGS = [
  ...sanitizeHtml.defaults.allowedTags,
  "img",
  "span",
  "u",
  "s",
  "mark",
  "h1",
  "h2",
];

// Inline styles survive since email clients ignore <style> blocks anyway.
const SANITIZE_OPTIONS = Object.freeze({
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    "*": ["style", "align"],
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "width", "height", "title"],
    td: ["colspan", "rowspan", "width"],
    th: ["colspan", "rowspan", "width"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener" }) },
});

function sanitizeEmailHtml(html) {
  return sanitizeHtml(String(html || ""), SANITIZE_OPTIONS);
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const MERGE_TAG_PATTERN = new RegExp(`{{\\s*(${MERGE_TAGS.join("|")})\\s*}}`, "g");

// "Hi {{first_name}}" must still read naturally for a contact with no name.
const MERGE_FALLBACKS = Object.freeze({ first_name: "there" });

/** Replaces {{first_name}} etc.; `escape` is off for plain-text subjects. */
function fillMergeTags(text, contact, { escape = true } = {}) {
  return String(text || "").replace(MERGE_TAG_PATTERN, (_, tag) => {
    const value = contact?.[tag] || MERGE_FALLBACKS[tag] || "";
    return escape ? escapeHtml(value) : value;
  });
}

/** True when the HTML has no visible text or image, e.g. "<p></p>". */
function isBlankHtml(html) {
  const text = sanitizeHtml(String(html || ""), { allowedTags: [], allowedAttributes: {} }).trim();
  return !text && !/<img\b/i.test(String(html || ""));
}

module.exports = { sanitizeEmailHtml, fillMergeTags, escapeHtml, isBlankHtml };
