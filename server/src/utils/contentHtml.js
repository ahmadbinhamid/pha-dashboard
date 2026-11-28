// utils/contentHtml.js
// Sanitises staff-written storefront HTML; derives excerpts and read time.

const sanitizeHtml = require("sanitize-html");
const { READING_WORDS_PER_MINUTE, EXCERPT_LENGTH } = require("../constants/seo.constants");

const OPTIONS = Object.freeze({
  allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "h1", "h2", "span", "u", "s", "mark", "figure", "figcaption"],
  allowedAttributes: {
    "*": ["style", "class"],
    a: ["href", "name", "target", "rel", "title"],
    img: ["src", "alt", "width", "height", "title", "loading"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // Only layout-safe inline styles, so content can't break the page.
  allowedStyles: { "*": { "text-align": [/^(left|right|center|justify)$/], color: [/^#[0-9a-f]{3,6}$/i] } },
  transformTags: {
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
});

function sanitizeContentHtml(html) {
  return sanitizeHtml(String(html || ""), OPTIONS);
}

// Block tags become spaces first, or "<h2>Tools</h2><p>You" reads "ToolsYou".
const BLOCK_TAG = /<\/?(p|div|h[1-6]|li|ul|ol|br|blockquote|tr|td|th|figcaption)\b[^>]*>/gi;

function plainText(html) {
  const spaced = String(html || "").replace(BLOCK_TAG, " ");
  return sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}

function readingMinutes(html) {
  const words = plainText(html).split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / READING_WORDS_PER_MINUTE));
}

/** First sentences of the body, cut on a word boundary. */
function autoExcerpt(html) {
  const text = plainText(html);
  if (text.length <= EXCERPT_LENGTH) return text;
  return `${text.slice(0, EXCERPT_LENGTH).replace(/\s+\S*$/, "")}…`;
}

module.exports = { sanitizeContentHtml, plainText, readingMinutes, autoExcerpt };
