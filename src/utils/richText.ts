// Rich-text fields (Settings → Fitment & Warranty Policies) store TipTap's HTML, but the invoice PDF is drawn by pdfkit, which only paints strings — so this parses the HTML into a tiny document model (blocks of styled runs) both the on-screen invoice and the PDF can draw identically. server/src/utils/richText.js mirrors this; change them together.
// Kept: paragraph/heading/list-item structure (incl. numbered-list numbering), bold, italic. Dropped: colours, alignment, heading size — a 7pt invoice footer has no room, and pdfkit's standard-14 font can't draw more anyway.
// Must survive: pre-rich-text plain strings with real newlines (no tags = treated as that), and TipTap's empty "<p></p>" reading as empty, not a blank line.

export interface RichTextRun {
  text: string;
  bold: boolean;
  italic: boolean;
}

export interface RichTextBlock {
  /** List marker to print before the line — "•" or "3." — or null for a plain block. */
  marker: string | null;
  runs: RichTextRun[];
}

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

const BLOCK_TAGS = /^(p|div|li|h[1-6]|blockquote|tr)$/;
const BOLD_TAGS = /^(strong|b)$/;
const ITALIC_TAGS = /^(em|i)$/;
const HEADING_TAGS = /^h[1-6]$/;

const BULLET_MARKER = "\u2022";

/** Adjacent runs with identical marks become one; the block is then trimmed. */
function normalizeRuns(runs: RichTextRun[]): RichTextRun[] {
  const merged: RichTextRun[] = [];
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

export function richTextToBlocks(value?: string | null): RichTextBlock[] {
  if (!value) return [];

  const raw = String(value);
  if (!/<[a-z][^>]*>/i.test(raw)) {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ marker: null, runs: [{ text, bold: false, italic: false }] }));
  }

  const blocks: RichTextBlock[] = [];
  let runs: RichTextRun[] = [];
  // Counters, not booleans: <strong>a <em>b</em> c</strong> must stay bold after the inner tag closes.
  let bold = 0;
  let italic = 0;
  let heading = 0;
  // Open <ul>/<ol> elements, so an ordered list numbers its own items without a nested list disturbing its parent's count.
  const lists: { ordered: boolean; count: number }[] = [];
  // Set by <li>, consumed by the first block with text — must survive the inner <p> the editor writes as <li><p>…</p></li>.
  let pendingMarker: string | null = null;

  const endBlock = () => {
    const normalized = normalizeRuns(runs);
    runs = [];
    if (!normalized.length) return;
    blocks.push({ marker: pendingMarker, runs: normalized });
    // Only the first line of a list item is marked; a second paragraph in the same <li> continues unmarked.
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
export function richTextToLines(value?: string | null): string[] {
  return richTextToBlocks(value).map(
    (block) => (block.marker ? `${block.marker} ` : "") + block.runs.map((run) => run.text).join(""),
  );
}

/** The whole value as one flowing paragraph, all marks dropped. */
export function richTextToParagraph(value?: string | null): string {
  return richTextToLines(value).join(" ");
}

/** True when the field holds nothing a reader would see. */
export function isRichTextEmpty(value?: string | null): boolean {
  return richTextToBlocks(value).length === 0;
}
