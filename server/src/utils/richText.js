// Server-side mirror of src/utils/richText.ts. The policy fields in Settings
// are authored with a rich-text editor and stored as HTML; pdfkit draws plain
// strings, so the PDF has to flatten them the same way the on-screen invoice
// does — the two renderers disagreeing about the footer is exactly what the
// shared GST/number helpers exist to prevent.
//
// Keep the two files in step: same block handling, same bullet character,
// same "plain text saved before this was rich text" fallback.

const HTML_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => HTML_ENTITIES[name.toLowerCase()] ?? match);
}

/** Each block of the value as one trimmed line; list items keep a bullet. */
function richTextToLines(value) {
  if (!value) return [];

  const looksLikeHtml = /<[a-z][^>]*>/i.test(value);
  if (!looksLikeHtml) {
    return String(value)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const text = String(value)
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    // A list item's marker is dropped with its tag, so it's re-added as a
    // character — otherwise bullets silently disappear off the invoice.
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\/\s*(p|div|li|h[1-6]|blockquote|tr)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "");

  return decodeEntities(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The whole value as one flowing paragraph — how the invoice footer sets it. */
function richTextToParagraph(value) {
  return richTextToLines(value).join(" ");
}

module.exports = { richTextToLines, richTextToParagraph };
