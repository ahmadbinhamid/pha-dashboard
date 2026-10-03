import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { TAG_BODY_FIELDS, TAG_LINE_HEIGHT, productTagDeepLink, tagSizeMm } from "@/config/productTag";
import type { Product } from "@/types/product";
import type { TagContent, TagFieldKey, TagFieldStyle, TagLayout, TagPrintItem, TagPrintJob, TagProduct, TagQueueItem, TagStyle, TagTextBlock } from "@/types/tags";

const PRINT_FRAME_ID = "tag-print-frame";
const GAP = 2.5;
const BLOCK_GAP = 0.8;
const TITLE_MIN_PT = 5;
const NOTE_MAX_LINES = 2;
// Caps the QR on tall labels so the text column keeps usable width.
const QR_MAX_WIDTH_SHARE = 0.45;
export const PT_TO_MM = 0.3528;
export const BAY_CHIP_PAD_MM = 1.2;

function latestNote(product: Product) {
  const latest = [...(product.internal_notes ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return latest?.text ?? null;
}

const clean = (text: string | null | undefined) => text?.replace(/\s+/g, " ").trim() || null;

/** Tag content from a full product (product page) or a queue row. */
export function tagContent(product: Product | TagProduct): TagContent {
  return {
    link: productTagDeepLink(product._id),
    title: product.title,
    note: clean("note" in product ? product.note : latestNote(product)),
    stockNumber: product.sku || null,
    bay: clean(product.bay),
  };
}

const FIELD_TEXT: Record<TagFieldKey, (c: TagContent) => string | null> = {
  title: (c) => c.title,
  note: (c) => c.note,
  stock_number: (c) => c.stockNumber,
  bay: (c) => (c.bay ? `BAY ${c.bay.toUpperCase()}` : null),
};

// Cuts text to `maxLines` lines of `width` mm, ending in "…" when trimmed.
function fitLines(doc: jsPDF, text: string, width: number, maxLines: number): string[] {
  if (maxLines <= 0) return [];
  const lines: string[] = doc.splitTextToSize(text, width);
  if (lines.length <= maxLines) return lines;
  let last = lines[maxLines - 1];
  while (last && doc.getTextWidth(`${last}…`) > width) last = last.slice(0, -1);
  return [...lines.slice(0, maxLines - 1), `${last.replace(/[\s.,;:!?-]+$/, "")}…`];
}

function setFont(doc: jsPDF, style: TagStyle, field: Pick<TagFieldStyle, "bold" | "size_pt">) {
  doc.setFont(style.font, field.bold ? "bold" : "normal");
  doc.setFontSize(field.size_pt);
}

// Largest size <= the field's that fits the whole title in `height` mm.
function fitTitle(doc: jsPDF, text: string, field: TagFieldStyle, style: TagStyle, width: number, height: number) {
  const lh = TAG_LINE_HEIGHT[style.line_spacing];
  for (let pt = field.size_pt; pt >= TITLE_MIN_PT; pt -= 0.25) {
    setFont(doc, style, { ...field, size_pt: pt });
    const lines: string[] = doc.splitTextToSize(text, width);
    if (lines.length * pt * PT_TO_MM * lh <= height) return { lines, pt };
  }
  return null;
}

let measurer: jsPDF | null = null;

/** Where every field goes; the PDF and the on-screen preview share this. */
export function layoutTag(content: TagContent, style: TagStyle, doc?: jsPDF): TagLayout {
  const { width: W, height: H } = tagSizeMm(style);
  // Text metrics don't depend on page size, so one measurer serves all sizes.
  const d = doc ?? (measurer ??= new jsPDF({ unit: "mm", format: [W, H], orientation: "landscape" }));
  const margin = style.margin_mm;
  const qrSize = Math.min(H - margin * 2, (W - margin * 2) * QR_MAX_WIDTH_SHARE);
  const textWidth = W - margin * 2 - qrSize - GAP;
  const lineHeight = TAG_LINE_HEIGHT[style.line_spacing];
  const lineMm = (pt: number) => pt * PT_TO_MM * lineHeight;
  const shown = (key: TagFieldKey) => style.fields.find((f) => f.key === key && f.visible && FIELD_TEXT[key](content));

  const stockField = shown("stock_number");
  const bayField = shown("bay");
  const footerPt = Math.max(stockField?.size_pt ?? 0, bayField?.size_pt ?? 0);
  const footerBaseline = H - margin - 0.6;
  const ruleY = footerBaseline - footerPt * PT_TO_MM - 1.4;
  const hasFooter = !!(stockField || bayField);
  const space = (hasFooter ? ruleY - 0.8 : H - margin) - margin;

  const bodyFields = style.fields.filter((f) => TAG_BODY_FIELDS.includes(f.key) && shown(f.key));
  const titleField = bodyFields.find((f) => f.key === "title");
  const noteField = bodyFields.find((f) => f.key === "note");
  const gaps = Math.max(bodyFields.length - 1, 0) * BLOCK_GAP;

  // The title must print in full; the note gives up lines first.
  let noteLines = noteField ? NOTE_MAX_LINES : 0;
  let title: { lines: string[]; pt: number } | null = null;
  while (titleField) {
    const noteMm = noteField ? noteLines * lineMm(noteField.size_pt) : 0;
    title = fitTitle(d, content.title, titleField, style, textWidth, space - noteMm - gaps);
    if (title || noteLines === 0) break;
    noteLines -= 1;
  }
  if (titleField && !title) {
    // Only a title too long even at the floor size is ever cut short.
    setFont(d, style, { ...titleField, size_pt: TITLE_MIN_PT });
    title = { lines: fitLines(d, content.title, textWidth, Math.floor((space - gaps) / lineMm(TITLE_MIN_PT))), pt: TITLE_MIN_PT };
  }

  const body: TagTextBlock[] = [];
  for (const f of bodyFields) {
    if (f.key === "title" && title) body.push({ key: f.key, lines: title.lines, pt: title.pt, bold: f.bold });
    if (f.key === "note" && noteLines > 0) {
      setFont(d, style, f);
      body.push({ key: f.key, lines: fitLines(d, content.note ?? "", textWidth, noteLines), pt: f.size_pt, bold: f.bold });
    }
  }

  const block = (f: TagFieldStyle | undefined, maxWidth: number): TagTextBlock | null => {
    if (!f) return null;
    setFont(d, style, f);
    const text = FIELD_TEXT[f.key](content) ?? "";
    const lines = d.getTextWidth(text) <= maxWidth ? [text] : fitLines(d, text, maxWidth, 1);
    return { key: f.key, lines, pt: f.size_pt, bold: f.bold };
  };
  const bay = block(bayField, textWidth * 0.6 - BAY_CHIP_PAD_MM * 2);
  const bayWidth = bay ? d.getTextWidth(bay.lines[0]) + BAY_CHIP_PAD_MM * 2 + 1.5 : 0;
  const stock = block(stockField, textWidth - bayWidth);

  return {
    width: W,
    margin,
    qrSize,
    textWidth,
    lineHeight,
    body: body.filter((b) => b.lines.length),
    footer: hasFooter ? { stock, bay } : null,
    footerBaseline,
    ruleY,
  };
}

// Vector QR: stays crisp on thermal printers and needs no async image step.
function drawQr(doc: jsPDF, text: string, x: number, y: number, size: number) {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const cell = size / modules.size;
  doc.setFillColor(0, 0, 0);
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      // Slight overlap hides hairline gaps between adjacent squares.
      if (modules.get(row, col)) doc.rect(x + col * cell, y + row * cell, cell + 0.01, cell + 0.01, "F");
    }
  }
}

function drawTag(doc: jsPDF, content: TagContent, style: TagStyle, layout: TagLayout) {
  const { width, margin, qrSize, textWidth, lineHeight } = layout;
  const qrLeft = style.qr_position === "left";
  drawQr(doc, content.link, qrLeft ? margin : width - margin - qrSize, margin, qrSize);
  const x = qrLeft ? margin + qrSize + GAP : margin;
  const center = style.align === "center";
  const textX = center ? x + textWidth / 2 : x;
  doc.setTextColor(0, 0, 0);

  let top = margin;
  for (const b of layout.body) {
    setFont(doc, style, { bold: b.bold, size_pt: b.pt });
    doc.text(b.lines, textX, top + b.pt * PT_TO_MM * 0.8, { lineHeightFactor: lineHeight, align: center ? "center" : "left" });
    top += b.lines.length * b.pt * PT_TO_MM * lineHeight + BLOCK_GAP;
  }

  if (!layout.footer) return;
  const { stock, bay } = layout.footer;
  doc.setLineWidth(0.2);
  doc.setDrawColor(0, 0, 0);
  doc.line(x, layout.ruleY, x + textWidth, layout.ruleY);
  if (bay) {
    // Inverted chip, right-aligned, so the bay stands out on a shelf.
    setFont(doc, style, { bold: bay.bold, size_pt: bay.pt });
    const chipW = doc.getTextWidth(bay.lines[0]) + BAY_CHIP_PAD_MM * 2;
    const chipH = bay.pt * PT_TO_MM + 1.3;
    const left = x + textWidth - chipW;
    doc.setFillColor(0, 0, 0);
    doc.roundedRect(left, layout.footerBaseline - chipH + 0.9, chipW, chipH, 0.6, 0.6, "F");
    doc.setTextColor(255, 255, 255);
    doc.text(bay.lines[0], left + BAY_CHIP_PAD_MM, layout.footerBaseline);
    doc.setTextColor(0, 0, 0);
  }
  if (stock) {
    setFont(doc, style, { bold: stock.bold, size_pt: stock.pt });
    doc.text(stock.lines[0], x, layout.footerBaseline);
  }
}

/** One PDF, one label-sized page per copy of every job, in order. */
export function buildTagsPdf(jobs: TagPrintJob[], style: TagStyle): jsPDF {
  const { width: W, height: H } = tagSizeMm(style);
  const doc = new jsPDF({ unit: "mm", format: [W, H], orientation: "landscape" });
  let first = true;
  for (const { content, copies } of jobs) {
    // Copies are identical, so fit the text once per job, not per page.
    const layout = layoutTag(content, style, doc);
    for (let i = 0; i < copies; i++) {
      if (!first) doc.addPage([W, H], "landscape");
      drawTag(doc, content, style, layout);
      first = false;
    }
  }
  return doc;
}

/** Prints in a hidden frame on this page; no new tab. */
export function printTags(jobs: TagPrintJob[], style: TagStyle) {
  const doc = buildTagsPdf(jobs, style);
  // Embedded print action: the PDF viewer opens the dialog once loaded.
  doc.autoPrint();
  const url = URL.createObjectURL(doc.output("blob"));
  document.getElementById(PRINT_FRAME_ID)?.remove();
  const frame = document.createElement("iframe");
  frame.id = PRINT_FRAME_ID;
  frame.src = url;
  frame.setAttribute("aria-hidden", "true");
  Object.assign(frame.style, { position: "fixed", width: "0", height: "0", border: "0", right: "0", bottom: "0" });
  document.body.appendChild(frame);
  // The frame stays until the next print so the dialog isn't cut short.
  frame.addEventListener("load", () => setTimeout(() => URL.revokeObjectURL(url), 60_000), { once: true });
}

/** A queue row as a print item. */
export function queuePrintItem(item: TagQueueItem): TagPrintItem {
  return { productId: item.product._id, label: item.product.sku ?? item.product.title, content: tagContent(item.product), copies: item.copies };
}
