// utils/pdf/lowStockReportPdf.js
//
// Renders the low-stock digest email's PDF attachment — a plain tabular
// report (item / SKU / variant / stock). Letterhead language (logo, rule
// weight, accent color) mirrors invoicePdf.js's tax invoice, but the layout
// is far simpler: no financial figures, just a list to action, so this
// doesn't share that file's column/meta-strip machinery.

const path = require("path");
const PDFDocument = require("pdfkit");

const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89;
const PAGE_MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CONTENT_RIGHT = PAGE_MARGIN + CONTENT_WIDTH;
const BOTTOM_LIMIT = PAGE_HEIGHT - PAGE_MARGIN - 24;

const LOGO_PATH = path.join(__dirname, "../../assets/branding/logo.png");
const LOGO_SIZE = 36;
const LOGO_TEXT_GAP = 10;

const FONT_BOLD = "Helvetica-Bold";
const FONT = "Helvetica";
const MONO = "Courier";

// Same palette as the dashboard's --accent/--danger/--border/--fg tokens
// (src/app/globals.css) — that file's own comment gives the exact hsl->hex
// mapping this hardcodes (email/PDF rendering can't read CSS variables).
const COLORS = {
  text: "#14181f",
  muted: "#6b7280",
  accent: "#f97015",
  border: "#e5e7eb",
  danger: "#ef4444",
};

const COLUMNS = { item: 0, sku: 270, variant: 370, stock: 470 };
const COLUMN_WIDTHS = { item: 262, sku: 92, variant: 92, stock: CONTENT_WIDTH - 470 };
const ROW_HEIGHT = 20;

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
}

function drawRule(doc, y, { color = COLORS.border, thickness = 0.75, width = CONTENT_WIDTH, x = PAGE_MARGIN } = {}) {
  doc.save().strokeColor(color).lineWidth(thickness).moveTo(x, y).lineTo(x + width, y).stroke().restore();
}

function drawLetterhead(doc, companyProfile, threshold) {
  const top = PAGE_MARGIN;
  const textX = PAGE_MARGIN + LOGO_SIZE + LOGO_TEXT_GAP;
  const rightWidth = 160;
  const rightX = CONTENT_RIGHT - rightWidth;
  const nameWidth = CONTENT_WIDTH - LOGO_SIZE - LOGO_TEXT_GAP - rightWidth - 16;

  doc
    .font(FONT_BOLD)
    .fontSize(7)
    .fillColor(COLORS.accent)
    .text("LOW STOCK REPORT", rightX, top + 2, { width: rightWidth, align: "right", characterSpacing: 1.6 });
  doc.font(FONT).fontSize(9).fillColor(COLORS.muted);
  doc.text(formatDate(new Date()), rightX, doc.y + 4, { width: rightWidth, align: "right" });

  doc.image(LOGO_PATH, PAGE_MARGIN, top, { width: LOGO_SIZE, height: LOGO_SIZE });
  doc
    .font(FONT_BOLD)
    .fontSize(13)
    .fillColor(COLORS.text)
    .text((companyProfile.company_name || "—").toUpperCase(), textX, top + 4, { width: nameWidth });

  if (threshold != null) {
    doc
      .font(FONT)
      .fontSize(9)
      .fillColor(COLORS.muted)
      .text(`Items at or below ${threshold} unit${threshold === 1 ? "" : "s"} in stock`, textX, doc.y + 4, {
        width: nameWidth,
      });
  }

  const ruleY = top + LOGO_SIZE + 14;
  drawRule(doc, ruleY, { color: COLORS.text, thickness: 2 });
  return ruleY + 20;
}

function drawTableHeader(doc, y) {
  doc.font(FONT_BOLD).fontSize(8).fillColor(COLORS.muted);
  doc.text("ITEM", PAGE_MARGIN + COLUMNS.item, y, { width: COLUMN_WIDTHS.item, characterSpacing: 0.6 });
  doc.text("SKU", PAGE_MARGIN + COLUMNS.sku, y, { width: COLUMN_WIDTHS.sku, characterSpacing: 0.6 });
  doc.text("VARIANT", PAGE_MARGIN + COLUMNS.variant, y, { width: COLUMN_WIDTHS.variant, characterSpacing: 0.6 });
  doc.text("STOCK", PAGE_MARGIN + COLUMNS.stock, y, {
    width: COLUMN_WIDTHS.stock,
    align: "right",
    characterSpacing: 0.6,
  });
  const ruleY = y + 14;
  drawRule(doc, ruleY, { color: COLORS.text, thickness: 1 });
  return ruleY + 10;
}

function drawRow(doc, item, y) {
  doc.font(FONT).fontSize(9).fillColor(COLORS.text);
  doc.text(item.title || "—", PAGE_MARGIN + COLUMNS.item, y, { width: COLUMN_WIDTHS.item - 8 });
  doc.font(MONO).fontSize(8.5).fillColor(COLORS.muted);
  doc.text(item.sku || "—", PAGE_MARGIN + COLUMNS.sku, y, { width: COLUMN_WIDTHS.sku - 8 });
  doc.font(FONT).fontSize(9).fillColor(COLORS.muted);
  doc.text(item.variant_name || "—", PAGE_MARGIN + COLUMNS.variant, y, { width: COLUMN_WIDTHS.variant - 8 });
  doc.font(FONT_BOLD).fontSize(9).fillColor(COLORS.danger);
  doc.text(String(item.stock), PAGE_MARGIN + COLUMNS.stock, y, { width: COLUMN_WIDTHS.stock, align: "right" });
  drawRule(doc, y + ROW_HEIGHT - 6, { color: "#f0f1f3" });
  return y + ROW_HEIGHT;
}

// items: getLowStockItems' own rows ({ title, sku, variant_name, stock, ... })
// — the same shape email.service.js#sendLowStockDigest receives, unmapped.
function buildLowStockReportPdfBuffer(items, { companyProfile = {}, threshold } = {}) {
  return new Promise((resolve, reject) => {
    // bufferPages: true — needed to stamp "Page X of Y" once every page
    // exists, same reasoning as invoicePdf.js's own use of this option.
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = drawLetterhead(doc, companyProfile, threshold);
    y = drawTableHeader(doc, y);

    items.forEach((item) => {
      if (y > BOTTOM_LIMIT) {
        doc.addPage();
        y = drawTableHeader(doc, PAGE_MARGIN);
      }
      y = drawRow(doc, item, y);
    });

    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i);
      doc
        .font(FONT)
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(`Page ${i + 1} of ${pageRange.count}`, PAGE_MARGIN, PAGE_HEIGHT - PAGE_MARGIN + 6, {
          width: CONTENT_WIDTH,
          align: "center",
        });
    }

    doc.end();
  });
}

module.exports = { buildLowStockReportPdfBuffer };
