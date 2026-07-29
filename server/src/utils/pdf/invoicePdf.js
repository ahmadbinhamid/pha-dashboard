// utils/pdf/invoicePdf.js
//
// Renders a Tax Invoice PDF for an order, generated server-side with pdfkit
// since this is headless (an email attachment), not the browser's print
// dialog. Palette, fonts, and layout are kept in lockstep with the
// dashboard's InvoicePrintView.tsx (the "Print Invoice" button) — same
// light theme, same colors, same field order — so the emailed PDF and the
// printed copy never disagree. pdfkit has no SVG/icon-font support, so the
// small check glyph is hand-drawn with vector primitives rather than pulled
// from an icon set (InvoicePrintView uses lucide-react icons directly since
// it renders in a browser).

const path = require("path");
const PDFDocument = require("pdfkit");
const {
  COMPANY_INFO,
  PICKUP_LOCATION,
  BANK_DETAILS,
  WARRANTY_TEXT,
  LEGAL_DISCLAIMER_TEXT,
} = require("../../constants/company.constants");
const { ORDER_DELIVERY_METHOD } = require("../../constants/order.constants");

const PAGE_MARGIN = 54;
const FRAME_PADDING = 20; // gap between the card border and its content
const CARD_RADIUS = 10;
// Column starts/widths must sum to <= CONTENT_WIDTH (487.28pt at the current
// PAGE_MARGIN) — seven columns: a row-number column plus GST/Qty/Discount
// each broken out as their own correctly-labeled column (order.tax_amount is
// only ever an order-level figure, so it can't answer "what's the GST on
// this specific line"). `total`'s width is deliberately short of the
// remaining space so its right-aligned text never sits flush against the
// table's outer border (every other column already gets this breathing
// room for free, via the 5pt gap before the next column).
const COLUMNS = { number: 0, item: 27, unitPrice: 182, gst: 247, qty: 304, discount: 339, total: 402 };
const COLUMN_WIDTHS = { number: 22, item: 150, unitPrice: 60, gst: 52, qty: 30, discount: 58, total: 76 };
const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89; // A4 points
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const LOGO_PATH = path.join(__dirname, "../../assets/branding/logo.png");
const LOGO_SIZE = 50;
const LOGO_TEXT_GAP = 14;
const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

// Same hex values as InvoicePrintView.tsx's INK/MUTED/ACCENT/BORDER/TINT_BG.
const COLORS = {
  text: "#18140f",
  muted: "#6b6f7a",
  accent: "#c2790b",
  border: "#e2e0da",
  tint: "#eef1f7",
  white: "#ffffff",
  green: "#16a34a",
};

function formatMoney(cents) {
  return `A$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date, opts) {
  return new Date(date).toLocaleDateString("en-AU", opts || { year: "numeric", month: "short", day: "numeric" });
}

// GST-inclusive AU retail pricing: extracted as total/11, never added on top
// of unit_price — same convention as order.service.js#GST_DIVISOR and the
// dashboard's utils/format.ts#getLineGst. order.tax_amount is only ever an
// order-level figure, so each line recomputes its own GST from its own
// (post-discount) total.
function lineGst(lineTotalCents) {
  return Math.round(lineTotalCents / 11);
}

// Same GST-inclusive convention as lineGst, applied to a single unit's
// inclusive price to get its GST-exclusive counterpart for display.
function lineExclusiveUnitPrice(unitPriceCents) {
  return unitPriceCents - lineGst(unitPriceCents);
}

function drawCheckIcon(doc, x, y, color, size = 9) {
  doc.save().lineWidth(1.4).strokeColor(color).lineJoin("round").lineCap("round");
  doc
    .moveTo(x, y + size * 0.5)
    .lineTo(x + size * 0.38, y + size * 0.85)
    .lineTo(x + size, y + size * 0.15)
    .stroke();
  doc.restore();
}

// Mirrors lucide's Landmark icon (used next to "Bank Transfer Details" in
// InvoicePrintView.tsx) as vector primitives — pdfkit can't pull in an icon
// font/SVG set the way the browser view does.
function drawBankIcon(doc, x, y, color, size = 9) {
  doc.save().lineWidth(1).strokeColor(color).lineJoin("round").lineCap("round");
  doc.moveTo(x, y + size * 0.32).lineTo(x + size * 0.5, y).lineTo(x + size, y + size * 0.32).stroke();
  doc.moveTo(x, y + size * 0.32).lineTo(x + size, y + size * 0.32).stroke();
  [0.14, 0.38, 0.62, 0.86].forEach((f) => {
    doc.moveTo(x + size * f, y + size * 0.42).lineTo(x + size * f, y + size * 0.82).stroke();
  });
  doc.moveTo(x - size * 0.05, y + size * 0.92).lineTo(x + size * 1.05, y + size * 0.92).stroke();
  doc.restore();
}

// Draws a small caps label (left) and a value (right), both within `width`,
// on one line — used for the header's Invoice Date / Due Date / Printed rows.
function drawMetaRow(doc, x, y, width, label, value, opts = {}) {
  const labelWidth = width * 0.4;
  doc.font(FONT).fontSize(7).fillColor(COLORS.muted).text(label, x, y + 1, { width: labelWidth });
  doc
    .font(opts.muted ? FONT : FONT_BOLD)
    .fontSize(8.5)
    .fillColor(opts.muted ? COLORS.muted : COLORS.text)
    .text(value, x + labelWidth, y, { width: width - labelWidth, align: "right" });
  return y + 13;
}

// Bold-label-then-value on one line (e.g. "ABN: 82 698 225 464") — pdfkit
// has no inline-bold markup, so alternating .font() calls with
// `continued: true` is the only way to mix weights on a single text line.
function drawInlineLabel(doc, x, y, width, segments) {
  segments.forEach((seg, i) => {
    doc
      .font(seg.bold ? FONT_BOLD : FONT)
      .fontSize(seg.size || 8)
      .fillColor(seg.color || COLORS.muted);
    if (i === 0) {
      doc.text(seg.text, x, y, { continued: i < segments.length - 1, width });
    } else {
      doc.text(seg.text, { continued: i < segments.length - 1 });
    }
  });
  return doc.y;
}

// Fixed width for the right-hand (Tax Invoice / dates) block — the left
// block (logo + company letterhead) gets whatever's left of CONTENT_WIDTH,
// which is most of it, so "PARTS HUB AUSTRALIA" never wraps.
const HEADER_RIGHT_WIDTH = 210;
const HEADER_GAP = 16;

function drawHeader(doc, order) {
  const textX = PAGE_MARGIN + LOGO_SIZE + LOGO_TEXT_GAP;
  const leftWidth = CONTENT_WIDTH - HEADER_RIGHT_WIDTH - HEADER_GAP - LOGO_SIZE - LOGO_TEXT_GAP;
  doc.image(LOGO_PATH, PAGE_MARGIN, PAGE_MARGIN, { width: LOGO_SIZE, height: LOGO_SIZE });

  doc
    .font(FONT_BOLD)
    .fontSize(15)
    .fillColor(COLORS.text)
    .text(COMPANY_INFO.name.toUpperCase(), textX, PAGE_MARGIN, { width: leftWidth });
  doc
    .font(FONT)
    .fontSize(8.5)
    .fillColor(COLORS.text)
    .text(`${PICKUP_LOCATION.address}, ${PICKUP_LOCATION.country}`, textX, doc.y + 5, { width: leftWidth });
  drawInlineLabel(doc, textX, doc.y + 4, leftWidth, [
    { text: "ABN: ", bold: true, color: COLORS.text },
    { text: `${COMPANY_INFO.abn}   |   `, color: COLORS.muted },
    { text: "PH: ", bold: true, color: COLORS.text },
    { text: COMPANY_INFO.phone, color: COLORS.muted },
  ]);
  drawInlineLabel(doc, textX, doc.y + 3, leftWidth, [
    { text: "EMAIL: ", bold: true, color: COLORS.text },
    { text: COMPANY_INFO.email, color: COLORS.muted },
  ]);
  doc.font(FONT_BOLD).fontSize(9).fillColor(COLORS.accent).text("Official Tax Invoice", textX, doc.y + 5);
  const leftBottomY = doc.y;

  const rightWidth = HEADER_RIGHT_WIDTH;
  const rightX = PAGE_MARGIN + CONTENT_WIDTH - rightWidth;
  doc
    .font(FONT_BOLD)
    .fontSize(22)
    .fillColor(COLORS.text)
    .text("TAX INVOICE", rightX, PAGE_MARGIN, { width: rightWidth, align: "right" });
  doc
    .font(FONT_BOLD)
    .fontSize(10)
    .fillColor(COLORS.accent)
    .text(order.invoice_number, rightX, doc.y + 4, { width: rightWidth, align: "right" });

  let my = doc.y + 12;
  my = drawMetaRow(doc, rightX, my, rightWidth, "INVOICE DATE:", formatDate(order.created_at).toUpperCase());
  my = drawMetaRow(doc, rightX, my, rightWidth, "DUE DATE:", "UPON RECEIPT");
  const now = new Date();
  const printedTime = now.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
  my = drawMetaRow(doc, rightX, my, rightWidth, "PRINTED:", `${formatDate(now).toUpperCase()} @ ${printedTime}`, {
    muted: true,
  });
  const rightBottomY = my;

  doc.fillColor(COLORS.text);
  doc.y = Math.max(leftBottomY, rightBottomY, PAGE_MARGIN + LOGO_SIZE);
  doc.moveDown(1.4);
  doc
    .strokeColor(COLORS.border)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.moveDown(1.4);
}

// Draws a small-caps label with a thin rule underneath it, spanning `width`
// — matches InvoicePrintView.tsx's LabelRule. Returns the y to start content
// below it.
function drawLabelRule(doc, x, y, width, label) {
  doc.font(FONT_BOLD).fontSize(8).fillColor(COLORS.muted).text(label, x, y, { width });
  const lineY = y + 11;
  doc.strokeColor(COLORS.border).lineWidth(0.75).moveTo(x, lineY).lineTo(x + width, lineY).stroke();
  return lineY + 8;
}

function drawBillShipTransactionBlock(doc, order) {
  const startY = doc.y;
  const colGap = 20;
  const colWidth = (CONTENT_WIDTH - colGap * 2) / 3;
  const col1X = PAGE_MARGIN;
  const col2X = PAGE_MARGIN + colWidth + colGap;
  const col3X = PAGE_MARGIN + (colWidth + colGap) * 2;

  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  const billingAddress = order.billing_address || order.shipping_address;

  // Bill To
  let y1 = drawLabelRule(doc, col1X, startY, colWidth, "BILL TO");
  doc.font(FONT_BOLD).fontSize(10.5).fillColor(COLORS.text).text(order.customer.name, col1X, y1, { width: colWidth });
  y1 = doc.y + 5;
  doc.font(FONT).fontSize(8).fillColor(COLORS.muted);
  if (billingAddress) {
    doc.text(billingAddress.address, col1X, y1, { width: colWidth });
    y1 = doc.y + 1;
    doc.text(`${billingAddress.suburb} ${billingAddress.state} ${billingAddress.postcode}, Australia`, col1X, y1, {
      width: colWidth,
    });
    y1 = doc.y + 1;
  }
  if (order.customer.phone) {
    doc.text(`PH: ${order.customer.phone}`, col1X, y1, { width: colWidth });
    y1 = doc.y + 1;
  }
  if (order.customer.email) {
    doc.text(`EMAIL: ${order.customer.email}`, col1X, y1, { width: colWidth });
    y1 = doc.y;
  }
  const bottom1 = y1;

  // Ship To
  let y2 = drawLabelRule(doc, col2X, startY, colWidth, "SHIP TO");
  doc.font(FONT_BOLD).fontSize(10.5).fillColor(COLORS.text).text(order.customer.name, col2X, y2, { width: colWidth });
  y2 = doc.y + 5;
  doc.font(FONT).fontSize(8).fillColor(COLORS.muted);
  if (isPickup || !order.shipping_address) {
    doc.text("Collecting in-store — see seller address above.", col2X, y2, { width: colWidth });
    y2 = doc.y;
  } else {
    doc.text(order.shipping_address.address, col2X, y2, { width: colWidth });
    y2 = doc.y + 1;
    doc.text(
      `${order.shipping_address.suburb} ${order.shipping_address.state} ${order.shipping_address.postcode}`,
      col2X,
      y2,
      { width: colWidth },
    );
    y2 = doc.y;
  }
  const bottom2 = y2;

  // Transaction — tint background drawn first (fixed height; content here
  // is always just a label + one value, so a fixed box reads fine).
  const boxPad = 10;
  const boxTop = startY - boxPad + 4;
  const boxHeight = 70;
  doc.roundedRect(col3X - boxPad, boxTop, colWidth + boxPad * 2, boxHeight, 6).fill(COLORS.tint);
  doc.fillColor(COLORS.text);
  let y3 = drawLabelRule(doc, col3X, startY, colWidth, "TRANSACTION");
  doc.font(FONT).fontSize(7.5).fillColor(COLORS.muted).text("ORDER NUMBER", col3X, y3, { width: colWidth });
  doc
    .font(FONT_BOLD)
    .fontSize(10)
    .fillColor(COLORS.text)
    .text(order.order_number, col3X, doc.y + 2, { width: colWidth });
  const bottom3 = Math.max(doc.y, boxTop + boxHeight);

  doc.fillColor(COLORS.text);
  doc.y = Math.max(bottom1, bottom2, bottom3);
  doc.moveDown(1.3);
}

const TABLE_HEADER_HEIGHT = 22;
// Item names get clamped to 2 lines (ellipsized beyond that) so a row's
// height is always predictable — an unbroken/very long product title (bad
// data, but real data we've seen) used to wrap to a dozen+ lines and blow
// the row past the page boundary mid-draw. pdfkit's own auto-pagination
// would then kick in *inside* the item-name .text() call, but the sibling
// cells (price/qty/discount/total) are drawn afterwards at that same
// pre-computed rowY — now meaningless on whatever page it auto-added —
// scattering a single row's columns across two or more pages. Measuring
// each row's height up front and deciding to paginate *before* drawing
// anything is what actually fixes it.
const ITEM_NAME_MAX_LINES = 2;

// Two-line column header ("UNIT PRICE" / "(EX GST)") for the two columns too
// narrow (60pt/76pt) to fit a GST-qualified label on one line at the
// header's normal font size — every other column stays single-line via the
// caller's own font/fontSize state, untouched by this helper.
function drawTwoLineColumnHeader(doc, x, y, width, mainLabel, subLabel) {
  doc.font(FONT_BOLD).fontSize(7).fillColor(COLORS.muted).text(mainLabel, x, y + 4, { width, align: "right" });
  doc.font(FONT).fontSize(6).fillColor(COLORS.muted).text(subLabel, x, y + 13, { width, align: "right" });
}

function drawItemsTableHeader(doc, y) {
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, TABLE_HEADER_HEIGHT).fill(COLORS.tint);

  doc.font(FONT_BOLD).fontSize(7.5).fillColor(COLORS.muted);
  const headerTextY = y + 7;
  doc.text("#", PAGE_MARGIN + 6 + COLUMNS.number, headerTextY, { width: COLUMN_WIDTHS.number - 6 });
  doc.text("DESCRIPTION / ITEM CODE", PAGE_MARGIN + COLUMNS.item, headerTextY, { width: COLUMN_WIDTHS.item });
  drawTwoLineColumnHeader(doc, PAGE_MARGIN + COLUMNS.unitPrice, y, COLUMN_WIDTHS.unitPrice, "UNIT PRICE", "(EX GST)");
  doc.font(FONT_BOLD).fontSize(7.5).fillColor(COLORS.muted);
  doc.text("GST (11%)", PAGE_MARGIN + COLUMNS.gst, headerTextY, { width: COLUMN_WIDTHS.gst, align: "right" });
  doc.text("QTY", PAGE_MARGIN + COLUMNS.qty, headerTextY, { width: COLUMN_WIDTHS.qty, align: "right" });
  doc.text("DISCOUNT", PAGE_MARGIN + COLUMNS.discount, headerTextY, { width: COLUMN_WIDTHS.discount, align: "right" });
  drawTwoLineColumnHeader(doc, PAGE_MARGIN + COLUMNS.total, y, COLUMN_WIDTHS.total, "TOTAL", "(INC GST)");
  doc.fillColor(COLORS.text);
  return y + TABLE_HEADER_HEIGHT;
}

function drawItemsTableSegmentBorder(doc, top, bottom) {
  doc.roundedRect(PAGE_MARGIN, top, CONTENT_WIDTH, bottom - top, 6).lineWidth(1).strokeColor(COLORS.border).stroke();
  doc.fillColor(COLORS.text);
}

// Fixed vertical space a row's content + separator rule take up, beyond the
// name/SKU block itself — mirrors the moveDown(0.8)/rule/moveDown(0.8) the
// draw step below performs, at the font sizes it runs them at.
const ROW_TRAILING_GAP = 17;

function estimateItemRowHeight(doc, item) {
  doc.font(FONT_BOLD).fontSize(9.5);
  let height = doc.currentLineHeight() * ITEM_NAME_MAX_LINES;
  if (item.sku) {
    doc.font(FONT).fontSize(7.5);
    height += 2 + doc.currentLineHeight();
  }
  return height + ROW_TRAILING_GAP;
}

function drawItemsTable(doc, order) {
  let segmentTop = doc.y;
  doc.y = drawItemsTableHeader(doc, segmentTop);
  doc.moveDown(1);

  const bottomLimit = PAGE_HEIGHT - PAGE_MARGIN - FRAME_PADDING;

  order.items.forEach((item, i) => {
    const estimatedHeight = estimateItemRowHeight(doc, item);
    if (doc.y + estimatedHeight > bottomLimit) {
      drawItemsTableSegmentBorder(doc, segmentTop, doc.y);
      doc.addPage();
      segmentTop = PAGE_MARGIN;
      doc.y = drawItemsTableHeader(doc, segmentTop);
      doc.moveDown(1);
    }

    const rowY = doc.y;
    doc
      .font(FONT)
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(String(i + 1).padStart(2, "0"), PAGE_MARGIN + 6 + COLUMNS.number, rowY, { width: COLUMN_WIDTHS.number - 6 });

    doc.font(FONT_BOLD).fontSize(9.5).fillColor(COLORS.text);
    const nameMaxHeight = doc.currentLineHeight() * ITEM_NAME_MAX_LINES;
    doc.text(item.name, PAGE_MARGIN + COLUMNS.item, rowY, {
      width: COLUMN_WIDTHS.item,
      height: nameMaxHeight,
      ellipsis: true,
    });
    let nameBottom = rowY + nameMaxHeight;
    if (item.sku) {
      doc
        .font(FONT)
        .fontSize(7.5)
        .fillColor(COLORS.muted)
        .text(`Part SKU: ${item.sku}`, PAGE_MARGIN + COLUMNS.item, nameBottom + 2, { width: COLUMN_WIDTHS.item });
      nameBottom = doc.y;
    }
    const rowBottomLeft = nameBottom;

    const lineSubtotal = item.unit_price * item.quantity;
    const discount = item.discount_amount || 0;
    const lineTotal = lineSubtotal - discount;
    const gst = lineGst(lineTotal);

    doc.font(FONT).fontSize(9).fillColor(COLORS.text);
    doc.text(formatMoney(lineExclusiveUnitPrice(item.unit_price)), PAGE_MARGIN + COLUMNS.unitPrice, rowY, {
      width: COLUMN_WIDTHS.unitPrice,
      align: "right",
    });
    const unitPriceBottom = doc.y;

    doc.font(FONT).fontSize(9).fillColor(COLORS.text);
    doc.text(formatMoney(gst), PAGE_MARGIN + COLUMNS.gst, rowY, { width: COLUMN_WIDTHS.gst, align: "right" });
    const gstBottom = doc.y;

    doc.text(String(item.quantity), PAGE_MARGIN + COLUMNS.qty, rowY, { width: COLUMN_WIDTHS.qty, align: "right" });
    const qtyBottom = doc.y;

    doc.text(formatMoney(discount), PAGE_MARGIN + COLUMNS.discount, rowY, {
      width: COLUMN_WIDTHS.discount,
      align: "right",
    });
    const discountBottom = doc.y;

    doc.font(FONT_BOLD).text(formatMoney(lineTotal), PAGE_MARGIN + COLUMNS.total, rowY, {
      width: COLUMN_WIDTHS.total,
      align: "right",
    });
    const totalBottom = doc.y;

    const rowBottomRight = Math.max(unitPriceBottom, gstBottom, qtyBottom, discountBottom, totalBottom);
    doc.y = Math.max(rowBottomLeft, rowBottomRight);
    doc.moveDown(0.8);
    doc
      .strokeColor(COLORS.border)
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .stroke();
    doc.moveDown(0.8);
  });

  const tableBottom = doc.y;
  drawItemsTableSegmentBorder(doc, segmentTop, tableBottom);
  doc.fillColor(COLORS.text);
  // Fixed gap (not moveDown, which scales with whatever font size a row
  // last set) so the Bank Transfer Details / Totals section never crowds
  // the table's bottom border.
  doc.y = tableBottom + 22;
}

function drawPaymentAndTotals(doc, order, totalPaidCents, totalRefundedCents) {
  const startY = doc.y;
  // Totals only ever hold short currency strings, so it doesn't need as much
  // width as a straight half/half split gives it — handing that space to the
  // bank details box instead is what keeps "PARTS HUB AUSTRALIA PTY LTD" and
  // "National Australia Bank" from wrapping and colliding with the row below.
  const totalsLabelWidth = 90;
  const totalsValueWidth = 80;
  const totalsWidth = totalsLabelWidth + totalsValueWidth;
  const gap = 16;
  const halfWidth = CONTENT_WIDTH - totalsWidth - gap;
  const rightX = PAGE_MARGIN + halfWidth + gap;

  // Bank Transfer Details — tint box, fixed height (always the same 4 fields).
  const boxHeight = 84;
  doc.roundedRect(PAGE_MARGIN, startY, halfWidth, boxHeight, 6).fill(COLORS.tint);
  doc.fillColor(COLORS.text);
  const iconSize = 8;
  drawBankIcon(doc, PAGE_MARGIN + 12, startY + 11, COLORS.muted, iconSize);
  doc
    .font(FONT_BOLD)
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text("BANK TRANSFER DETAILS", PAGE_MARGIN + 12 + iconSize + 6, startY + 11, {
      width: halfWidth - 24 - iconSize - 6,
    });

  const gridColWidth = (halfWidth - 24) / 2;
  const bankRows = [
    ["BANK NAME", BANK_DETAILS.bankName || "—"],
    ["ACCOUNT NAME", BANK_DETAILS.accountName || COMPANY_INFO.name],
    ["BSB", BANK_DETAILS.bsb || "—"],
    ["ACCOUNT NO", BANK_DETAILS.accountNumber || "—"],
  ];
  const gridStartY = startY + 30;
  bankRows.forEach(([label, value], idx) => {
    const colX = PAGE_MARGIN + 12 + (idx % 2) * gridColWidth;
    const rowY = gridStartY + Math.floor(idx / 2) * 26;
    doc.font(FONT).fontSize(6.5).fillColor(COLORS.muted).text(label, colX, rowY, { width: gridColWidth - 8 });
    doc
      .font(FONT_BOLD)
      .fontSize(7.5)
      .fillColor(COLORS.text)
      .text(value, colX, rowY + 9, { width: gridColWidth - 8 });
  });

  let leftBottomY = startY + boxHeight + 10;

  // Payment-received pill — only when something's actually been collected;
  // otherwise a plain "not yet paid" line rather than a false confirmation.
  if (totalPaidCents > 0) {
    const CHANNEL_LABEL = { ebay: "EBAY", manual: "IN-STORE" };
    const channelLabel = CHANNEL_LABEL[order.channel] ?? "STOREFRONT";
    const pillLabel = `PAYMENT RECEIVED VIA ${channelLabel}`;
    doc.font(FONT_BOLD).fontSize(8);
    const pillTextWidth = doc.widthOfString(pillLabel);
    const pillHeight = 20;
    const pillWidth = pillTextWidth + 34;
    doc.roundedRect(PAGE_MARGIN, leftBottomY, pillWidth, pillHeight, pillHeight / 2).fill(COLORS.green);
    drawCheckIcon(doc, PAGE_MARGIN + 10, leftBottomY + 5, COLORS.white, 8);
    doc.fillColor(COLORS.white).text(pillLabel, PAGE_MARGIN + 24, leftBottomY + 6, { width: pillWidth - 24 });
    leftBottomY += pillHeight;
  } else {
    doc.font(FONT).fontSize(8.5).fillColor(COLORS.muted).text("No payment recorded yet.", PAGE_MARGIN, leftBottomY);
    leftBottomY = doc.y;
  }

  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  // Item-level discounts plus any legacy order-level discount (see Order.js's
  // discount_amount comment) — order.subtotal already nets these out, so
  // Subtotal below adds them back to show the pre-discount figure, same
  // convention as the dashboard's order-detail page/InvoicePrintView.tsx.
  const itemDiscount = order.items.reduce((sum, i) => sum + (i.discount_amount || 0), 0);
  const totalDiscount = itemDiscount + (order.discount_amount || 0);

  let rowY = startY;
  const totalsRows = [["Subtotal", formatMoney(order.subtotal + totalDiscount)]];
  // Always shown, even at $0 — combines every line item's own discount with
  // any legacy order-level discount.
  totalsRows.push(["Discount", totalDiscount > 0 ? `-${formatMoney(totalDiscount)}` : formatMoney(0)]);
  totalsRows.push([isPickup ? "Pickup" : "Freight / Shipping", formatMoney(order.shipping_cost)]);
  totalsRows.forEach(([label, value]) => {
    doc.font(FONT).fontSize(9).fillColor(COLORS.muted).text(label, rightX, rowY, { width: totalsLabelWidth });
    doc
      .font(FONT_BOLD)
      .fontSize(9.5)
      .fillColor(COLORS.text)
      .text(value, rightX + totalsLabelWidth, rowY, { width: totalsValueWidth, align: "right" });
    rowY += 19;
  });
  rowY += 4;
  doc
    .strokeColor(COLORS.border)
    .moveTo(rightX, rowY)
    .lineTo(rightX + totalsWidth, rowY)
    .stroke();
  rowY += 12;
  doc.font(FONT_BOLD).fontSize(11).fillColor(COLORS.text).text("Total", rightX, rowY, { width: totalsLabelWidth });
  doc
    .fillColor(COLORS.accent)
    .fontSize(14)
    .text(formatMoney(order.total), rightX + totalsLabelWidth, rowY - 2, { width: totalsValueWidth, align: "right" });
  rowY += 30;

  // Every channel can now carry an outstanding balance — storefront/eBay
  // prices are editable after the fact (see updateOrderItemPrice), not just
  // manual sales — mirroring InvoicePrintView.tsx's generalized Balance
  // Outstanding treatment. A refund does NOT always mean "nothing more is
  // owed" — see utils/paymentTotals.ts#getBalanceDue (the frontend twin of
  // this logic) for the full reasoning: paid-in-full-then-refunded means due
  // is 0 regardless of the raw remainder, but never-paid-in-full-then-
  // refunded-on-top means the real shortfall is still owed. totalPaidCents
  // is already net of refunds, so totalPaidCents + totalRefundedCents
  // reconstructs the gross amount ever collected.
  const grossPaidCents = (totalPaidCents || 0) + (totalRefundedCents || 0);
  const wasEverPaidInFull = grossPaidCents >= order.total;
  const isFullyRefunded = order.status === "refunded";
  const amountDue = wasEverPaidInFull || isFullyRefunded ? 0 : Math.max(0, order.total - (totalPaidCents || 0));

  // Total Paid / Total Due are always shown, even at $0 — same convention as
  // the totals rows above. Total Refunded only appears when non-zero — most
  // orders never have one. The colored bar further below still calls out an
  // outstanding balance specifically, but only when there is one.
  const paymentRows = [
    ["Total Paid", formatMoney(totalPaidCents || 0)],
  ];
  if (totalRefundedCents > 0) {
    paymentRows.push(["Total Refunded", formatMoney(totalRefundedCents)]);
  }
  paymentRows.push(["Total Due", formatMoney(amountDue)]);
  paymentRows.forEach(([label, value]) => {
    doc.font(FONT).fontSize(8.5).fillColor(COLORS.muted).text(label, rightX, rowY, { width: totalsLabelWidth });
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(COLORS.text)
      .text(value, rightX + totalsLabelWidth, rowY, { width: totalsValueWidth, align: "right" });
    rowY += 16;
  });
  rowY += 4;

  if (amountDue > 0) {
    const barWidth = totalsWidth;
    const barHeight = 28;
    doc.roundedRect(rightX, rowY, barWidth, barHeight, 6).fill(COLORS.accent);
    doc
      .font(FONT_BOLD)
      .fontSize(7.5)
      .fillColor(COLORS.white)
      .text("BALANCE OUTSTANDING", rightX + 10, rowY + 6, { width: barWidth - 20 });
    doc.fontSize(10.5).text(formatMoney(amountDue), rightX + 10, rowY + 15, { width: barWidth - 20, align: "right" });
    rowY += barHeight + 4;
  }

  doc.fillColor(COLORS.text);
  doc.y = Math.max(leftBottomY, rowY);
}

// Warranty & Returns / Legal Disclaimer footer, matching
// InvoicePrintView.tsx's tinted footer section — replaces the old single
// italic INVOICE_NOTE line that used to sit under Payment Information.
function drawFooter(doc, bottomY) {
  const boxPad = 16;
  const colGap = 24;
  const colWidth = CONTENT_WIDTH / 2 - colGap / 2 - boxPad * 2;

  doc.font(FONT).fontSize(7.5);
  const leftTextHeight = doc.heightOfString(WARRANTY_TEXT, { width: colWidth, lineGap: 1.5 });
  const rightTextHeight = doc.heightOfString(LEGAL_DISCLAIMER_TEXT, { width: colWidth, lineGap: 1.5 });
  const headerHeight = 16;
  const boxHeight = boxPad * 2 + headerHeight + Math.max(leftTextHeight, rightTextHeight);

  // Pinned to the bottom of the page, like InvoicePrintView.tsx's `mt-auto`
  // footer — falls back to sitting right after the table (rather than
  // overlapping it) only if the order has enough line items to push content
  // past where the footer would otherwise sit.
  const pageBottomTarget = PAGE_HEIGHT - PAGE_MARGIN - FRAME_PADDING - boxHeight;
  const boxY = Math.max(bottomY + 12, pageBottomTarget);

  doc.roundedRect(PAGE_MARGIN, boxY, CONTENT_WIDTH, boxHeight, 8).fill(COLORS.tint);
  doc.fillColor(COLORS.text);

  const textY = boxY + boxPad;
  doc
    .font(FONT_BOLD)
    .fontSize(8)
    .fillColor(COLORS.text)
    .text("WARRANTY & RETURNS", PAGE_MARGIN + boxPad, textY, { width: colWidth });
  doc
    .font(FONT)
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(WARRANTY_TEXT, PAGE_MARGIN + boxPad, doc.y + 4, { width: colWidth, lineGap: 1.5 });

  const col2X = PAGE_MARGIN + CONTENT_WIDTH / 2 + colGap / 2;
  doc.font(FONT_BOLD).fontSize(8).fillColor(COLORS.text).text("LEGAL DISCLAIMER", col2X, textY, { width: colWidth });
  doc
    .font(FONT)
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(LEGAL_DISCLAIMER_TEXT, col2X, doc.y + 4, { width: colWidth, lineGap: 1.5 });

  doc.fillColor(COLORS.text);
  return boxY + boxHeight;
}

// Drawn once per page, after every other page's worth of content already
// exists (see buildInvoicePdfBuffer's bufferPages/switchToPage pass) — sits
// in the true bottom margin, below both the items-table segment border on an
// intermediate page and the card border/footer box on the final page, so it
// never collides with either.
//
// pdfkit's .text() still auto-paginates against the page's own bottom
// margin even when given explicit x/y coordinates below it — writing this
// close to PAGE_HEIGHT silently triggered doc.addPage() and put the label on
// a brand new blank page instead of the intended one. Zeroing the bottom
// margin for the duration of this one call (the standard pdfkit workaround)
// stops that check from firing.
function drawPageNumber(doc, pageIndex, pageCount) {
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc
    .font(FONT)
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text(`Page ${pageIndex + 1} of ${pageCount}`, PAGE_MARGIN, PAGE_HEIGHT - 24, {
      width: CONTENT_WIDTH,
      align: "center",
    });
  doc.page.margins.bottom = originalBottomMargin;
}

// Frames the whole invoice in a rounded-corner card, matching
// InvoicePrintView.tsx's card border — drawn last (as a stroke-only outline)
// so it simply overlays the page edges without covering any already-drawn
// content.
function drawCardBorder(doc, bottomY) {
  const x = PAGE_MARGIN - FRAME_PADDING;
  const y = PAGE_MARGIN - FRAME_PADDING;
  const width = CONTENT_WIDTH + FRAME_PADDING * 2;
  const height = bottomY - PAGE_MARGIN + FRAME_PADDING * 2;
  doc.roundedRect(x, y, width, height, CARD_RADIUS).lineWidth(1.25).strokeColor(COLORS.border).stroke();
}

// totalPaidCents/totalRefundedCents: sums of Payment fields for the order
// (see payment.service.js#getTotalPaidForOrder/#getTotalRefundedForOrder) —
// the caller computes these since they require a DB query this pure
// rendering function shouldn't make itself.
function buildInvoicePdfBuffer(order, { totalPaidCents = 0, totalRefundedCents = 0 } = {}) {
  return new Promise((resolve, reject) => {
    // bufferPages: true is required to go back and draw onto earlier pages
    // (switchToPage below) after later pages already exist — the total page
    // count for "Page X of Y" isn't known until every page has been drawn.
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, order);
    drawBillShipTransactionBlock(doc, order);
    drawItemsTable(doc, order);
    drawPaymentAndTotals(doc, order, totalPaidCents, totalRefundedCents);
    const footerBottomY = drawFooter(doc, doc.y);
    drawCardBorder(doc, footerBottomY);

    const pageRange = doc.bufferedPageRange();
    for (let i = pageRange.start; i < pageRange.start + pageRange.count; i++) {
      doc.switchToPage(i);
      drawPageNumber(doc, i, pageRange.count);
    }

    doc.end();
  });
}

module.exports = { buildInvoicePdfBuffer };
