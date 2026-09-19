// Rich-text fields (Settings → Fitment & Warranty Policies) are stored as the
// HTML TipTap produces. Everywhere that renders them outside a browser — the
// invoice, and the PDF's mirror of it in server/src/utils/richText.js — needs
// them as plain lines instead, so the conversion lives here rather than being
// re-improvised per call site.
//
// Two things this has to survive:
//   * Values saved BEFORE these fields became rich text, which are plain
//     strings with real newlines. Anything with no tag in it is treated as
//     exactly that.
//   * TipTap's empty document, "<p></p>", which must read as empty, not as a
//     blank line.

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => HTML_ENTITIES[name.toLowerCase()] ?? match);
}

/** Each block of the value as one trimmed line; list items keep a bullet. */
export function richTextToLines(value?: string | null): string[] {
  if (!value) return [];

  const looksLikeHtml = /<[a-z][^>]*>/i.test(value);
  if (!looksLikeHtml) {
    return value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const text = value
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
export function richTextToParagraph(value?: string | null): string {
  return richTextToLines(value).join(" ");
}

/** True when the field holds nothing a reader would see. */
export function isRichTextEmpty(value?: string | null): boolean {
  return richTextToLines(value).length === 0;
}
