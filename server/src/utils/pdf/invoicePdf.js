// utils/pdf/invoicePdf.js
// Tax Invoice PDF via pdfkit; kept in lockstep with InvoicePrintView.tsx.

const path = require("path");
const PDFDocument = require("pdfkit");
const { ORDER_DELIVERY_METHOD } = require("../../constants/order.constants");
const { formatInvoiceNumber } = require("../orderNumberFormat");
const { richTextToBlocks } = require("../richText");
const { stripEbayAddressPrefix } = require("../addressFormat");

const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89; // A4 points
const PAGE_MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CONTENT_RIGHT = PAGE_MARGIN + CONTENT_WIDTH;
// Footer reserve for the page-count rule stamped after layout.
const PAGE_RULE_RESERVE = 46;
const BOTTOM_LIMIT = PAGE_HEIGHT - PAGE_MARGIN - PAGE_RULE_RESERVE;

const LOGO_PATH = path.join(__dirname, "../../assets/branding/logo.png");
const LOGO_SIZE = 36;
const LOGO_TEXT_GAP = 10;

// Helvetica stands in for Arial: same metrics, built in, nothing to embed.
const FONT_BOLD = "Helvetica-Bold";
const FONT = "Helvetica";
// Rich-text policy fields can carry italic and bold-italic runs too.
const FONT_ITALIC = "Helvetica-Oblique";
const FONT_BOLD_ITALIC = "Helvetica-BoldOblique";

// U+2022 is in WinAnsi; markers outside it would print blank.
const markerRun = (marker) => ({ text: `${marker} `, bold: false, italic: false });

// Matches InvoicePrintView.tsx; goldOnInk is readable on the ink bar.
const COLORS = {
  text: "#000000",
  accent: "#c2790b",
  border: "#e2e0da",
  white: "#ffffff",
  green: "#15803d",
  goldOnInk: "#e0a83a",
};

// Column starts/widths sum to CONTENT_WIDTH.
const COLUMNS = { number: 0, item: 22, unitPrice: 186, gst: 256, qty: 326, discount: 352, total: 422 };
const COLUMN_WIDTHS = { number: 18, item: 160, unitPrice: 66, gst: 66, qty: 22, discount: 66, total: 65 };
// A$1,234,567.89 fits the narrowest numeric column at this size.
const FIGURE_SIZE = 7.5;

const CHANNEL_LABEL = { ebay: "eBay", manual: "In-Store" };

function channelLabelFor(order) {
  return CHANNEL_LABEL[order.channel] ?? "Storefront";
}

function formatMoney(cents) {
  return `A$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date, opts) {
  return new Date(date).toLocaleDateString("en-AU", opts || { year: "numeric", month: "short", day: "numeric" });
}

// GST-inclusive pricing: per-line GST is total/11, never added on top.
function lineGst(lineTotalCents) {
  return Math.round(lineTotalCents / 11);
}

// GST-exclusive unit price for display, same convention as lineGst.
function lineExclusiveUnitPrice(unitPriceCents) {
  return unitPriceCents - lineGst(unitPriceCents);
}

// ─── Primitives ───

// Measured, not width-wrapped: lineBreak:false alone still wraps in pdfkit.
function drawRightAligned(doc, text, rightEdgeX, y, opts = {}) {
  const w = doc.widthOfString(text, opts);
  doc.text(text, rightEdgeX - w, y, { lineBreak: false, ...opts });
}

function drawRule(doc, y, { width = CONTENT_WIDTH, x = PAGE_MARGIN, color = COLORS.border, thickness = 0.75 } = {}) {
  doc
    .save()
    .strokeColor(color)
    .lineWidth(thickness)
    .moveTo(x, y)
    .lineTo(x + width, y)
    .stroke()
    .restore();
}

function drawVerticalRule(doc, x, top, bottom, color = COLORS.border) {
  doc.save().strokeColor(color).lineWidth(0.75).moveTo(x, top).lineTo(x, bottom).stroke().restore();
}

// Caps section label; returns the y content starts at.
function drawSectionLabel(doc, label, x, y, { width = CONTENT_WIDTH, align = "left", color = COLORS.text } = {}) {
  doc
    .font(FONT_BOLD)
    .fontSize(6.5)
    .fillColor(color)
    .text(label.toUpperCase(), x, y, { width, align, characterSpacing: 1.1 });
  return y + 11;
}

// Caps label over a value; returns the y below the value.
function drawLabelledValue(doc, label, value, x, y, width, { labelSize = 6, valueSize = 8, valueFont = FONT } = {}) {
  doc
    .font(FONT_BOLD)
    .fontSize(labelSize)
    .fillColor(COLORS.text)
    .text(label.toUpperCase(), x, y, { width, characterSpacing: 0.9 });
  const valueY = y + labelSize + 4;
  doc.font(valueFont).fontSize(valueSize).fillColor(COLORS.text).text(value, x, valueY, { width });
  return valueY + valueSize + 3;
}

// ─── Sections ───

function drawLetterhead(doc, order, companyProfile) {
  const top = PAGE_MARGIN;
  const textX = PAGE_MARGIN + LOGO_SIZE + LOGO_TEXT_GAP;
  const rightWidth = 110;
  const rightX = CONTENT_RIGHT - rightWidth;
  // Company name must stop short of the TAX INVOICE block.
  const nameWidth = CONTENT_WIDTH - LOGO_SIZE - LOGO_TEXT_GAP - rightWidth - 16;

  // Drawn first so seller details can drop below it when too wide.
  doc
    .font(FONT_BOLD)
    .fontSize(7)
    .fillColor(COLORS.text)
    .text("TAX INVOICE", rightX, top + 2, { width: rightWidth, align: "right", characterSpacing: 2.2 });
  doc.font(FONT_BOLD).fontSize(16).fillColor(COLORS.text);
  drawRightAligned(doc, formatInvoiceNumber(order.invoice_number_prefix, order.invoice_number), CONTENT_RIGHT, doc.y + 4);
  const rightBottom = doc.y + 16;

  doc.image(LOGO_PATH, PAGE_MARGIN, top, { width: LOGO_SIZE, height: LOGO_SIZE });
  doc
    .font(FONT_BOLD)
    .fontSize(12.5)
    .fillColor(COLORS.text)
    .text((companyProfile.company_name || "—").toUpperCase(), textX, top, { width: nameWidth, characterSpacing: -0.2 });

  const addressLine =
    [companyProfile.pickup_location?.address, companyProfile.pickup_location?.country].filter(Boolean).join(", ") || "—";
  const detailLines = [
    addressLine,
    companyProfile.email,
    companyProfile.phone,
    companyProfile.abn ? `ABN ${companyProfile.abn}` : null,
  ].filter(Boolean);
  // Address, email, phone and ABN each on their own line, filled ones only.

  // Details sit beside the invoice number if they fit, else drop below it.
  doc.font(FONT).fontSize(7.5);
  const fitsBeside = detailLines.every((line) => doc.widthOfString(line) <= nameWidth);
  const detailWidth = fitsBeside ? nameWidth : CONTENT_WIDTH - LOGO_SIZE - LOGO_TEXT_GAP;
  const detailY = fitsBeside ? doc.y + 3 : Math.max(doc.y + 3, rightBottom + 6);

  doc.fillColor(COLORS.text);
  let leftBottom = detailY;
  detailLines.forEach((line) => {
    doc.text(line, textX, leftBottom, { width: detailWidth });
    leftBottom = doc.y + 1;
  });

  const ruleY = Math.max(leftBottom, top + LOGO_SIZE) + 14;
  drawRule(doc, ruleY, { color: COLORS.text, thickness: 2.5 });
  doc.fillColor(COLORS.text);
  return ruleY;
}

// Order Number is the customer's reference; dropped when blank.
function drawMetaStrip(doc, order, topY) {
  const cells = [
    ["Invoice Date", formatDate(order.created_at)],
    ["Due Date", "Due on receipt"],
    ...(order.reference_number ? [["Order Number", order.reference_number]] : []),
    ["Sales Channel", channelLabelFor(order)],
  ];
  const cellWidth = CONTENT_WIDTH / cells.length;
  const padY = 11;
  const cellPadX = 12;
  const contentY = topY + padY;
  let bottom = contentY;

  cells.forEach(([label, value], idx) => {
    const cellX = PAGE_MARGIN + idx * cellWidth;
    const textX = idx === 0 ? cellX : cellX + cellPadX;
    const textWidth = cellWidth - (idx === 0 ? 8 : cellPadX + 8);
    bottom = Math.max(bottom, drawLabelledValue(doc, label, value, textX, contentY, textWidth, { valueSize: 9 }));
  });

  const stripBottom = bottom + padY - 3;
  cells.forEach((_, idx) => {
    if (idx > 0) drawVerticalRule(doc, PAGE_MARGIN + idx * cellWidth, topY + 6, stripBottom - 4);
  });
  drawRule(doc, stripBottom);
  return stripBottom;
}

// NOTE: no billing address entered means no Bill To; contact moves to Ship To.
function partyBlockLines(order) {
  const { billing_address: billing, shipping_address: shipping, customer } = order;
  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  const contactLines = [
    customer.phone ? `Phone: ${customer.phone}` : null,
    customer.email ? `Email: ${customer.email}` : null,
  ].filter(Boolean);
  const shipAddress =
    isPickup || !shipping
      ? ["Customer collection from the store address above."]
      : [stripEbayAddressPrefix(shipping.address), `${shipping.suburb} ${shipping.state} ${shipping.postcode}`];

  if (!billing) return { billLines: null, shipLines: [...shipAddress, ...contactLines] };
  return {
    billLines: [
      stripEbayAddressPrefix(billing.address),
      `${billing.suburb} ${billing.state} ${billing.postcode}, Australia`,
      ...contactLines,
    ],
    shipLines: shipAddress,
  };
}

// Bill To left (when present), Ship To always in the right column.
function drawPartiesBlock(doc, order, topY) {
  const colWidth = 215;
  const startY = topY + 20;
  // Company name takes over the customer's name slot on the invoice when set.
  const displayName = order.customer.company_name || order.customer.name;
  const { billLines, shipLines } = partyBlockLines(order);

  const billBottom = billLines
    ? drawPartyColumn(doc, "Bill To", displayName, billLines, PAGE_MARGIN, startY, colWidth)
    : startY;
  const shipBottom = drawPartyColumn(doc, "Ship To", displayName, shipLines, CONTENT_RIGHT - colWidth, startY, colWidth);

  doc.fillColor(COLORS.text);
  return Math.max(shipBottom, billBottom);
}

function drawPartyColumn(doc, label, displayName, lines, x, y, width) {
  let cursor = drawSectionLabel(doc, label, x, y, { width });
  doc
    .font(FONT_BOLD)
    .fontSize(9.5)
    .fillColor(COLORS.text)
    .text(displayName.toUpperCase(), x, cursor + 3, { width, characterSpacing: -0.2 });
  cursor = doc.y + 5;
  doc.font(FONT).fontSize(7.5).fillColor(COLORS.text);
  lines.forEach((line) => {
    doc.text(line, x, cursor, { width });
    cursor = doc.y + 1.5;
  });
  return cursor;
}

const TABLE_HEADER_HEIGHT = 20;

function drawItemsTableHeader(doc, y) {
  drawRule(doc, y);
  const headerTextY = y + 8;
  doc.font(FONT_BOLD).fontSize(6.5).fillColor(COLORS.text);
  const spacing = { characterSpacing: 0.9 };
  doc.text("#", PAGE_MARGIN + COLUMNS.number, headerTextY, { width: COLUMN_WIDTHS.number, ...spacing });
  doc.text("DESCRIPTION", PAGE_MARGIN + COLUMNS.item, headerTextY, { width: COLUMN_WIDTHS.item, ...spacing });
  const rightLabels = [
    ["UNIT EX GST", "unitPrice"],
    ["GST 11%", "gst"],
    ["QTY", "qty"],
    ["DISCOUNT", "discount"],
    ["TOTAL INC GST", "total"],
  ];
  rightLabels.forEach(([text, key]) => {
    doc.text(text, PAGE_MARGIN + COLUMNS[key], headerTextY, { width: COLUMN_WIDTHS[key], align: "right", ...spacing });
  });
  const bottom = y + TABLE_HEADER_HEIGHT;
  drawRule(doc, bottom, { color: COLORS.text, thickness: 1.25 });
  doc.fillColor(COLORS.text);
  return bottom;
}

// Rows are pre-measured so a long name never splits a row across pages.
const ROW_PAD_TOP = 9;
const ROW_PAD_BOTTOM = 9;

// Title with its SKU in brackets on the same line, saving a row per item.
const itemLabel = (item) => (item.sku ? `${item.name} (SKU: ${item.sku})` : item.name);

function estimateItemRowHeight(doc, item) {
  doc.font(FONT).fontSize(9.5);
  return doc.heightOfString(itemLabel(item), { width: COLUMN_WIDTHS.item }) + ROW_PAD_TOP + ROW_PAD_BOTTOM;
}

function drawItemRow(doc, item, index, y) {
  const textY = y + ROW_PAD_TOP;

  doc
    .font(FONT)
    .fontSize(FIGURE_SIZE)
    .fillColor(COLORS.text)
    .text(String(index + 1).padStart(2, "0"), PAGE_MARGIN + COLUMNS.number, textY, { width: COLUMN_WIDTHS.number });

  doc.font(FONT).fontSize(9.5).fillColor(COLORS.text);
  const label = itemLabel(item);
  const leftBottom = textY + doc.heightOfString(label, { width: COLUMN_WIDTHS.item });
  doc.text(label, PAGE_MARGIN + COLUMNS.item, textY, { width: COLUMN_WIDTHS.item });

  const discount = item.discount_amount || 0;
  const lineTotal = item.unit_price * item.quantity - discount;

  doc.font(FONT).fontSize(FIGURE_SIZE).fillColor(COLORS.text);
  drawRightAligned(doc, formatMoney(lineExclusiveUnitPrice(item.unit_price)), PAGE_MARGIN + COLUMNS.unitPrice + COLUMN_WIDTHS.unitPrice, textY);
  drawRightAligned(doc, formatMoney(lineGst(lineTotal)), PAGE_MARGIN + COLUMNS.gst + COLUMN_WIDTHS.gst, textY);
  drawRightAligned(doc, String(item.quantity), PAGE_MARGIN + COLUMNS.qty + COLUMN_WIDTHS.qty, textY);
  // A real discount is signed; zero stays unsigned, as on screen.
  doc.fillColor(COLORS.text);
  drawRightAligned(doc, discount > 0 ? `-${formatMoney(discount)}` : formatMoney(0), PAGE_MARGIN + COLUMNS.discount + COLUMN_WIDTHS.discount, textY);
  doc.font(FONT_BOLD).fillColor(COLORS.text);
  drawRightAligned(doc, formatMoney(lineTotal), PAGE_MARGIN + COLUMNS.total + COLUMN_WIDTHS.total, textY);

  const rowBottom = Math.max(leftBottom, textY + 10) + ROW_PAD_BOTTOM;
  drawRule(doc, rowBottom);
  return rowBottom;
}

function drawItemsTable(doc, order, topY) {
  let y = drawItemsTableHeader(doc, topY);

  order.items.forEach((item, i) => {
    if (y + estimateItemRowHeight(doc, item) > BOTTOM_LIMIT) {
      doc.addPage();
      y = drawItemsTableHeader(doc, PAGE_MARGIN);
    }
    y = drawItemRow(doc, item, i, y);
  });

  doc.fillColor(COLORS.text);
  return y;
}

// Absolute-y draws past the margin each spawn a blank page; pre-check fit.
const PAYMENT_AND_TOTALS_HEIGHT_ESTIMATE = 250;
const TOTALS_WIDTH = 190;

function drawPaymentDetails(doc, order, companyProfile, totalPaidCents, x, y, width) {
  let cursor = drawSectionLabel(doc, "Payment Details", x, y, { width });
  cursor += 5;

  const bankDetails = companyProfile.bank_details || {};
  const bankRows = [
    ["Bank Name", bankDetails.bank_name || "—"],
    ["Account Name", bankDetails.account_name || companyProfile.company_name || "—"],
    ["BSB", bankDetails.bsb || "—"],
    ["Account No", bankDetails.account_number || "—"],
  ];
  // Each row starts below the measured one above; account names can wrap.
  const gridColWidth = width / 2;
  let rowY = cursor;
  for (let row = 0; row * 2 < bankRows.length; row += 1) {
    let rowBottom = rowY;
    bankRows.slice(row * 2, row * 2 + 2).forEach(([label, value], col) => {
      rowBottom = Math.max(
        rowBottom,
        drawLabelledValue(doc, label, value, x + col * gridColWidth, rowY, gridColWidth - 10, { valueSize: 7.5 }),
      );
    });
    rowY = rowBottom + 8;
  }
  const gridBottom = rowY - 8;

  const isPaid = totalPaidCents > 0;

  // Status stamp: paid/unpaid plus the sales channel.
  const stampY = gridBottom + 12;
  const stampColor = isPaid ? COLORS.green : COLORS.accent;
  const stampLabel = isPaid ? "PAID" : "UNPAID";
  const channelText = channelLabelFor(order).toUpperCase();
  doc.font(FONT_BOLD).fontSize(13);
  const stampLabelWidth = doc.widthOfString(stampLabel);
  doc.font(FONT).fontSize(7);
  const channelWidth = doc.widthOfString(channelText, { characterSpacing: 0.8 });
  const stampWidth = stampLabelWidth + channelWidth + 30;
  const stampHeight = 24;
  doc.roundedRect(x, stampY, stampWidth, stampHeight, 2).lineWidth(1).strokeColor(stampColor).stroke();
  doc.font(FONT_BOLD).fontSize(13).fillColor(COLORS.text).text(stampLabel, x + 10, stampY + 6);
  doc
    .font(FONT)
    .fontSize(7)
    .fillColor(COLORS.text)
    .text(channelText, x + 10 + stampLabelWidth + 10, stampY + 10, { characterSpacing: 0.8, lineBreak: false });

  return stampY + stampHeight;
}

// Totals ledger line: label left, figure right.
function drawTotalRow(doc, label, value, x, y, width) {
  doc.font(FONT).fontSize(8).fillColor(COLORS.text).text(label, x, y, { width, lineBreak: false });
  drawRightAligned(doc, value, x + width, y);
  return y + 14;
}

function drawTotals(doc, order, totalPaidCents, totalRefundedCents, x, y, width) {
  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  // Includes legacy order-level discount; order.subtotal already nets it out.
  const itemDiscount = order.items.reduce((sum, i) => sum + (i.discount_amount || 0), 0);
  const totalDiscount = itemDiscount + (order.discount_amount || 0);
  // order.tax_amount is the stored GST; reused so totals never disagree.
  const gstAmount = order.tax_amount || 0;
  const exGstSubtotal = order.subtotal - gstAmount;

  let cursor = y;
  // Pre-discount subtotal and discount lines only when discounted.
  if (totalDiscount > 0) {
    cursor = drawTotalRow(doc, "Subtotal", formatMoney(order.subtotal + totalDiscount), x, cursor, width);
    cursor = drawTotalRow(doc, "Discount", `-${formatMoney(totalDiscount)}`, x, cursor, width);
  }
  cursor = drawTotalRow(doc, "Subtotal (ex GST)", formatMoney(exGstSubtotal), x, cursor, width);
  cursor = drawTotalRow(doc, "GST (11%)", formatMoney(gstAmount), x, cursor, width);
  cursor = drawTotalRow(doc, isPickup ? "Pickup" : "Freight", formatMoney(order.shipping_cost), x, cursor, width);

  // Solid ink bar — the one piece of heavy emphasis on the sheet.
  const barY = cursor + 8;
  const barHeight = 30;
  doc.rect(x, barY, width, barHeight).fill(COLORS.text);
  doc
    .font(FONT_BOLD)
    .fontSize(6.5)
    .fillColor(COLORS.white)
    .text("TOTAL INC GST", x + 12, barY + 12, { characterSpacing: 1, lineBreak: false });
  doc.font(FONT_BOLD).fontSize(10).fillColor(COLORS.goldOnInk);
  drawRightAligned(doc, formatMoney(order.total), x + width - 12, barY + 10);
  cursor = barY + barHeight + 10;

  // Paid-then-refunded is $0 due; partial-then-refunded still owes.
  const grossPaidCents = (totalPaidCents || 0) + (totalRefundedCents || 0);
  const wasEverPaidInFull = grossPaidCents >= order.total;
  const isFullyRefunded = order.status === "refunded";
  const amountDue = wasEverPaidInFull || isFullyRefunded ? 0 : Math.max(0, order.total - (totalPaidCents || 0));

  // Paid / due rows always shown, even at $0.
  cursor = drawTotalRow(doc, "Total paid", formatMoney(totalPaidCents || 0), x, cursor, width);
  if (totalRefundedCents > 0) {
    cursor = drawTotalRow(doc, "Total refunded", formatMoney(totalRefundedCents), x, cursor, width);
  }
  cursor = drawTotalRow(doc, "Total due", formatMoney(amountDue), x, cursor, width);

  // Any channel can owe a balance, since prices can change post-payment.
  if (amountDue > 0) {
    const barTop = cursor + 6;
    const outstandingHeight = 26;
    doc.rect(x, barTop, width, outstandingHeight).fill(COLORS.accent);
    doc
      .font(FONT_BOLD)
      .fontSize(6)
      .fillColor(COLORS.white)
      .text("BALANCE OUTSTANDING", x + 10, barTop + 10, { characterSpacing: 0.9, lineBreak: false });
    doc.font(FONT_BOLD).fontSize(9).fillColor(COLORS.white);
    drawRightAligned(doc, formatMoney(amountDue), x + width - 10, barTop + 8);
    cursor = barTop + outstandingHeight;
  }

  doc.fillColor(COLORS.text);
  return cursor;
}

function drawPaymentAndTotals(doc, order, totalPaidCents, totalRefundedCents, companyProfile, topY) {
  let startY = topY + 20;
  if (startY + PAYMENT_AND_TOTALS_HEIGHT_ESTIMATE > BOTTOM_LIMIT) {
    doc.addPage();
    startY = PAGE_MARGIN;
  }

  const gap = 26;
  const leftWidth = CONTENT_WIDTH - TOTALS_WIDTH - gap;
  const leftBottom = drawPaymentDetails(doc, order, companyProfile, totalPaidCents, PAGE_MARGIN, startY, leftWidth);
  const rightBottom = drawTotals(doc, order, totalPaidCents, totalRefundedCents, CONTENT_RIGHT - TOTALS_WIDTH, startY, TOTALS_WIDTH);
  return Math.max(leftBottom, rightBottom);
}

// Rich text: parsed HTML runs, bold/italic via Helvetica faces.

function runFont(run) {
  if (run.bold && run.italic) return FONT_BOLD_ITALIC;
  if (run.bold) return FONT_BOLD;
  if (run.italic) return FONT_ITALIC;
  return FONT;
}

/** Height measured in bold, the widest face, so it never under-estimates. */
function measureRichText(doc, blocks, { width, size, lineGap }) {
  doc.font(FONT_BOLD).fontSize(size);
  return blocks.reduce((total, block) => {
    const line = (block.marker ? `${block.marker} ` : "") + block.runs.map((run) => run.text).join("");
    return total + doc.heightOfString(line, { width, lineGap });
  }, 0);
}

/** Draws the blocks from (x, y) and returns the y it finished at. */
function drawRichText(doc, blocks, x, y, { width, size, lineGap, color }) {
  doc.fillColor(color);
  let cursor = y;

  blocks.forEach((block) => {
    const runs = block.marker ? [markerRun(block.marker), ...block.runs] : block.runs;

    runs.forEach((run, index) => {
      const last = index === runs.length - 1;
      const options = { width, lineGap, continued: !last };
      doc.font(runFont(run)).fontSize(size);
      // Only a line's first run is positioned so later runs stay inline.
      if (index === 0) doc.text(run.text, x, cursor, options);
      else doc.text(run.text, options);
    });

    cursor = doc.y;
  });

  return cursor;
}

// Warranty / disclaimer columns flow after totals, not pinned to the foot.
function drawFooter(doc, companyProfile, topY) {
  // pdfkit auto-paginates below the bottom margin; disabled during this draw.
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  const colGap = 26;
  const colWidth = (CONTENT_WIDTH - colGap) / 2;
  const lineGap = 1.4;
  const bodySize = 7;
  // Same parsed blocks as InvoiceRichText.tsx, so formatting matches.
  const emptyBlock = [{ marker: null, runs: [{ text: "—", bold: false, italic: false }] }];
  const warrantyBlocks = richTextToBlocks(companyProfile.warranty_text);
  const legalBlocks = richTextToBlocks(companyProfile.legal_disclaimer_text);
  const warranty = warrantyBlocks.length ? warrantyBlocks : emptyBlock;
  const legal = legalBlocks.length ? legalBlocks : emptyBlock;

  const bodyHeight = Math.max(
    measureRichText(doc, warranty, { width: colWidth, size: bodySize, lineGap }),
    measureRichText(doc, legal, { width: colWidth, size: bodySize, lineGap }),
  );
  const blockHeight = 11 + 6 + bodyHeight;

  // Breaks to a new page only when it doesn't fit on the current one.
  let ruleY = topY + 26;
  if (ruleY + blockHeight > BOTTOM_LIMIT) {
    doc.addPage();
    ruleY = PAGE_MARGIN;
  }

  drawRule(doc, ruleY);
  const textY = ruleY + 10;
  const col2X = PAGE_MARGIN + colWidth + colGap;
  drawSectionLabel(doc, "Warranty & Returns", PAGE_MARGIN, textY, { width: colWidth });
  drawSectionLabel(doc, "Legal Disclaimer", col2X, textY, { width: colWidth });
  const bodyOpts = { width: colWidth, size: bodySize, lineGap, color: COLORS.text };
  drawRichText(doc, warranty, PAGE_MARGIN, textY + 13, bodyOpts);
  drawRichText(doc, legal, col2X, textY + 13, bodyOpts);

  doc.fillColor(COLORS.text);
  doc.page.margins.bottom = originalBottomMargin;
}

// Page-count rule drawn last; zero bottom margin stops a stray addPage.
function drawPageRule(doc, pageIndex, pageCount) {
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const ruleY = PAGE_HEIGHT - PAGE_MARGIN - 18;
  drawRule(doc, ruleY);
  doc.font(FONT).fontSize(6).fillColor(COLORS.text);
  drawRightAligned(doc, `Page ${pageIndex + 1} of ${pageCount}`, CONTENT_RIGHT, ruleY + 7);
  doc.page.margins.bottom = originalBottomMargin;
}

// Paid/refunded totals come from the caller; this renderer never hits the DB.
function buildInvoicePdfBuffer(order, { totalPaidCents = 0, totalRefundedCents = 0, companyProfile = {} } = {}) {
  return new Promise((resolve, reject) => {
    // bufferPages lets the page-count pass revisit earlier pages.
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    let y = drawLetterhead(doc, order, companyProfile);
    y = drawMetaStrip(doc, order, y);
    y = drawPartiesBlock(doc, order, y);
    y = drawItemsTable(doc, order, y + 22);
    y = drawPaymentAndTotals(doc, order, totalPaidCents, totalRefundedCents, companyProfile, y);
    drawFooter(doc, companyProfile, y);

    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i);
      drawPageRule(doc, i, pageRange.count);
    }

    doc.end();
  });
}

module.exports = { buildInvoicePdfBuffer, partyBlockLines };
