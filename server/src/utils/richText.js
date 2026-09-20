// Server-side mirror of src/utils/richText.ts — see that file for the why.
// The policy fields in Settings are authored with a rich-text editor and
// stored as HTML; pdfkit paints strings, so the HTML is parsed into blocks of
// styled runs that invoicePdf.js draws with font switches. The two renderers
// disagreeing about the footer is exactly what the shared GST/number helpers
// exist to prevent, so keep the two files in step: same block handling, same
// list markers, same "plain text saved before this was rich text" fallback.

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

const BLOCK_TAGS = /^(p|div|li|h[1-6]|blockquote|tr)$/;
const BOLD_TAGS = /^(strong|b)$/;
const ITALIC_TAGS = /^(em|i)$/;
const HEADING_TAGS = /^h[1-6]$/;

const BULLET_MARKER = "\u2022";

/** Adjacent runs with identical marks become one; the block is then trimmed. */
function normalizeRuns(runs) {
  const merged = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italic === run.italic) last.text += run.text;
    else merged.push({ ...run });
  }
  if (merged.length) {
    merged[0].text = merged[0].text.replace(/^\s+/, "");
    merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\s+$/, "");
  }
  return merged.filter((run) => run.text.length > 0);
}

function richTextToBlocks(value) {
  if (!value) return [];

  const raw = String(value);
  if (!/<[a-z][^>]*>/i.test(raw)) {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ marker: null, runs: [{ text, bold: false, italic: false }] }));
  }

  const blocks = [];
  let runs = [];
  // Counters, not booleans: <strong>a <em>b</em> c</strong> has to stay bold
  // after the inner tag closes.
  let bold = 0;
  let italic = 0;
  let heading = 0;
  // Open <ul>/<ol> elements, so an ordered list can number its own items and
  // a nested list doesn't disturb its parent's count.
  const lists = [];
  // Set by <li>, consumed by the first block that actually has text in it.
  // The editor writes <li><p>…</p></li>, so the marker has to survive the
  // inner <p> opening — which is exactly what an eager reset got wrong.
  let pendingMarker = null;

  const endBlock = () => {
    const normalized = normalizeRuns(runs);
    runs = [];
    if (!normalized.length) return;
    blocks.push({ marker: pendingMarker, runs: normalized });
    // Only the FIRST line of a list item is marked; a second paragraph inside
    // the same <li> continues underneath it unmarked.
    pendingMarker = null;
  };

  for (const token of raw.split(/(<[^>]*>)/)) {
    if (!token) continue;

    if (token.startsWith("<")) {
      const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)/i.exec(token);
      if (!match) continue;
      const closing = match[1] === "/";
      const tag = match[2].toLowerCase();

      if (tag === "br") {
        endBlock();
      } else if (BOLD_TAGS.test(tag)) {
        bold = Math.max(0, bold + (closing ? -1 : 1));
      } else if (ITALIC_TAGS.test(tag)) {
        italic = Math.max(0, italic + (closing ? -1 : 1));
      } else if (tag === "ul" || tag === "ol") {
        endBlock();
        if (closing) lists.pop();
        else lists.push({ ordered: tag === "ol", count: 0 });
      } else if (BLOCK_TAGS.test(tag)) {
        endBlock();
        if (HEADING_TAGS.test(tag)) heading = Math.max(0, heading + (closing ? -1 : 1));
        if (tag === "li") {
          if (closing) {
            pendingMarker = null;
          } else {
            const list = lists[lists.length - 1];
            if (list) list.count += 1;
            pendingMarker = list?.ordered ? `${list.count}.` : BULLET_MARKER;
          }
        }
      }
      continue;
    }

    const text = decodeEntities(token).replace(/\s+/g, " ");
    if (text) runs.push({ text, bold: bold > 0 || heading > 0, italic: italic > 0 });
  }

  endBlock();
  return blocks;
}

/** Each block as one trimmed line, list markers included. */
function richTextToLines(value) {
  return richTextToBlocks(value).map(
    (block) => (block.marker ? `${block.marker} ` : "") + block.runs.map((run) => run.text).join(""),
  );
}

/** The whole value as one flowing paragraph, all marks dropped. */
function richTextToParagraph(value) {
  return richTextToLines(value).join(" ");
}

module.exports = { richTextToBlocks, richTextToLines, richTextToParagraph };
