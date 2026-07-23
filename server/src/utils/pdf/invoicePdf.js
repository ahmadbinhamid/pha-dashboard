// utils/pdf/invoicePdf.js
//
// Renders a Tax Invoice PDF for an order, generated server-side with pdfkit
// since this is headless (an email attachment), not the browser's print
// dialog. Palette, fonts, and layout are kept in lockstep with the
// dashboard's InvoicePrintView.tsx (the "Print Invoice" button) — same
// light theme, same colors, same field order — so the emailed PDF and the
// printed copy never disagree. pdfkit has no SVG/icon-font support, so the
// small building/pin/mail glyphs are hand-drawn with vector primitives
// rather than pulled from an icon set (InvoicePrintView uses lucide-react
// icons directly since it renders in a browser).

const path = require("path");
const PDFDocument = require("pdfkit");
const { COMPANY_INFO, PICKUP_LOCATION } = require("../../constants/company.constants");
const { ORDER_DELIVERY_METHOD } = require("../../constants/order.constants");

const PAGE_MARGIN = 54;
const FRAME_PADDING = 20; // gap between the card border and its content
const CARD_RADIUS = 10;
// Column starts/widths must sum to <= CONTENT_WIDTH (487.28pt at the current
// PAGE_MARGIN) — previous values summed to 495 and bled ~8pt past the table's
// shaded header/divider lines, clipping the TOTAL PRICE column.
const COLUMNS = { item: 0, qty: 235, unitPrice: 292, total: 385 };
const COLUMN_WIDTHS = { item: 225, qty: 47, unitPrice: 88, total: 95 };
const PAGE_WIDTH = 595.28; // A4 points
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const LOGO_PATH = path.join(__dirname, "../../assets/branding/logo.png");
const LOGO_SIZE = 46;
const LOGO_TEXT_GAP = 14;
const ICON_SIZE = 9;
const ICON_TEXT_GAP = 7;
const LINE_GAP = 7; // vertical gap between stacked icon-led detail lines
const FONT = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

// Same hex values as InvoicePrintView.tsx's INK/MUTED/ACCENT/BORDER/TABLE_HEAD_BG.
const COLORS = {
  text: "#1f1a14",
  muted: "#7b7065",
  accent: "#c39113",
  border: "#d8d4ca",
  tableHeaderBg: "#f6f3ec",
  statusGoodBorder: "#10b981", // emerald-500/600, matching the print view's pill
  statusGoodText: "#059669",
  statusPendingBorder: "#f59e0b", // amber-500/600
  statusPendingText: "#d97706",
};

function formatMoney(cents) {
  return `A$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
}

// --- Small hand-drawn icons (pdfkit has no SVG/icon-font support) ---------

function drawBuildingIcon(doc, x, y, color) {
  doc.save().lineWidth(0.9).strokeColor(color);
  doc.rect(x, y, ICON_SIZE, ICON_SIZE).stroke();
  const pad = ICON_SIZE * 0.22;
  const win = (ICON_SIZE - pad * 3) / 2;
  [0, 1].forEach((row) =>
    [0, 1].forEach((col) => doc.rect(x + pad + col * (win + pad), y + pad + row * (win + pad), win, win).stroke()),
  );
  doc.restore();
}

function drawPinIcon(doc, x, y, color) {
  doc.save().lineWidth(0.9).strokeColor(color);
  const r = ICON_SIZE * 0.32;
  const cx = x + ICON_SIZE / 2;
  const cy = y + r + 0.5;
  doc.circle(cx, cy, r).stroke();
  doc
    .moveTo(cx - r * 0.55, cy + r * 0.55)
    .lineTo(cx, y + ICON_SIZE)
    .lineTo(cx + r * 0.55, cy + r * 0.55)
    .stroke();
  doc.restore();
}

function drawMailIcon(doc, x, y, color) {
  doc.save().lineWidth(0.9).strokeColor(color);
  const h = ICON_SIZE * 0.72;
  const top = y + (ICON_SIZE - h) / 2;
  doc.rect(x, top, ICON_SIZE, h).stroke();
  doc
    .moveTo(x, top)
    .lineTo(x + ICON_SIZE / 2, top + h * 0.55)
    .lineTo(x + ICON_SIZE, top)
    .stroke();
  doc.restore();
}

// Draws `icon` + `text` as one line at the given y, indented consistently so
// icon-led lines line up under the (icon-less) bold name line above them.
function iconLine(doc, icon, text, x, y, width, opts = {}) {
  icon(doc, x, y + 1.5, opts.iconColor || COLORS.muted);
  doc
    .font(opts.font || FONT)
    .fontSize(opts.fontSize || 9.5)
    .fillColor(opts.color || COLORS.muted)
    .text(text, x + ICON_SIZE + ICON_TEXT_GAP, y, { width: width - ICON_SIZE - ICON_TEXT_GAP });
  return doc.y;
}

function drawHeader(doc, order) {
  const textX = PAGE_MARGIN + LOGO_SIZE + LOGO_TEXT_GAP;
  doc.image(LOGO_PATH, PAGE_MARGIN, PAGE_MARGIN, { width: LOGO_SIZE, height: LOGO_SIZE });

  doc.font(FONT_BOLD).fontSize(20).fillColor(COLORS.text).text(`INVOICE #${order.order_number}`, textX, PAGE_MARGIN);
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`ORDER DATE: ${formatDate(order.created_at).toUpperCase()}`, textX, doc.y + 7);

  const isPaid = order.status !== "pending_payment";
  const pillLabel = isPaid ? "PAID & SECURED" : "PENDING PAYMENT";
  const pillBorder = isPaid ? COLORS.statusGoodBorder : COLORS.statusPendingBorder;
  const pillText = isPaid ? COLORS.statusGoodText : COLORS.statusPendingText;
  doc.font(FONT_BOLD).fontSize(9);
  const pillTextWidth = doc.widthOfString(pillLabel);
  const pillPaddingX = 10;
  const pillWidth = pillTextWidth + pillPaddingX * 2;
  const pillHeight = 20;
  const pillX = PAGE_MARGIN + CONTENT_WIDTH - pillWidth;
  const pillY = PAGE_MARGIN;
  doc.roundedRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2).lineWidth(1).strokeColor(pillBorder).stroke();
  doc.fillColor(pillText).text(pillLabel, pillX, pillY + 6, { width: pillWidth, align: "center" });

  const channelLabel = `CHANNEL: ${order.channel === "ebay" ? "EBAY" : "STOREFRONT"}`;
  const channelBoxWidth = Math.max(pillWidth, doc.widthOfString(channelLabel) + 4);
  doc
    .font(FONT)
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(channelLabel, PAGE_MARGIN + CONTENT_WIDTH - channelBoxWidth, pillY + pillHeight + 6, {
      width: channelBoxWidth,
      align: "right",
    });

  doc.fillColor(COLORS.text);
  doc.y = Math.max(doc.y, pillY + pillHeight + 26, PAGE_MARGIN + LOGO_SIZE);
  doc.moveDown(1.4);
  doc
    .strokeColor(COLORS.border)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.moveDown(1.4);
}

function drawPartiesBlock(doc, order) {
  const startY = doc.y;
  const halfWidth = CONTENT_WIDTH / 2 - 14;
  const rightX = PAGE_MARGIN + halfWidth + 28;

  // Left column — seller
  doc.font(FONT_BOLD).fontSize(9).fillColor(COLORS.accent).text("SELLER PROFILE", PAGE_MARGIN, startY);
  doc
    .font(FONT_BOLD)
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(COMPANY_INFO.name, PAGE_MARGIN, doc.y + 6, { width: halfWidth });

  let y = doc.y + 9;
  y = iconLine(doc, drawBuildingIcon, `ABN ${COMPANY_INFO.abn}`, PAGE_MARGIN, y, halfWidth) + LINE_GAP;
  y = iconLine(doc, drawPinIcon, `${PICKUP_LOCATION.address}, ${PICKUP_LOCATION.country}`, PAGE_MARGIN, y, halfWidth) + LINE_GAP;
  y = iconLine(doc, drawMailIcon, COMPANY_INFO.email, PAGE_MARGIN, y, halfWidth) + LINE_GAP;
  const leftBottomY = y;

  // Right column — customer
  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  doc
    .font(FONT_BOLD)
    .fontSize(9)
    .fillColor(COLORS.accent)
    .text(isPickup ? "CUSTOMER DETAILS" : "BILLING & DELIVERY ADDRESS", rightX, startY, { width: halfWidth });
  doc
    .font(FONT_BOLD)
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(order.customer.name, rightX, doc.y + 6, { width: halfWidth });

  let ry = doc.y + 9;
  if (isPickup) {
    ry = iconLine(doc, drawMailIcon, order.customer.email, rightX, ry, halfWidth) + LINE_GAP;
    ry = iconLine(doc, drawPinIcon, "Collecting in-store — see seller address above.", rightX, ry, halfWidth) + LINE_GAP;
  } else {
    ry =
      iconLine(
        doc,
        drawPinIcon,
        `${order.shipping_address.address}, ${order.shipping_address.suburb}, ${order.shipping_address.state} ${order.shipping_address.postcode}, Australia`,
        rightX,
        ry,
        halfWidth,
      ) + LINE_GAP;
    ry = iconLine(doc, drawMailIcon, order.customer.email, rightX, ry, halfWidth) + LINE_GAP;
    if (order.billing_address) {
      doc
        .font(FONT)
        .fontSize(8)
        .fillColor(COLORS.muted)
        .text(
          `Billing: ${order.billing_address.address}, ${order.billing_address.suburb}, ${order.billing_address.state} ${order.billing_address.postcode}`,
          rightX,
          ry,
          { width: halfWidth },
        );
      ry = doc.y + LINE_GAP;
    }
  }
  const rightBottomY = ry;

  doc.fillColor(COLORS.text);
  doc.y = Math.max(leftBottomY, rightBottomY);
  doc.moveDown(1.4);
  doc
    .strokeColor(COLORS.border)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.moveDown(1.4);
}

function drawItemsTable(doc, order) {
  const headerY = doc.y;
  const headerHeight = 26;
  doc.rect(PAGE_MARGIN, headerY, CONTENT_WIDTH, headerHeight).fill(COLORS.tableHeaderBg);

  doc.font(FONT_BOLD).fontSize(9).fillColor(COLORS.muted);
  const headerTextY = headerY + 9;
  doc.text("ITEM SPEC & PART SKU", PAGE_MARGIN + 12 + COLUMNS.item, headerTextY, { width: COLUMN_WIDTHS.item - 12 });
  doc.text("QTY", PAGE_MARGIN + COLUMNS.qty, headerTextY, { width: COLUMN_WIDTHS.qty, align: "right" });
  doc.text("UNIT PRICE", PAGE_MARGIN + COLUMNS.unitPrice, headerTextY, { width: COLUMN_WIDTHS.unitPrice, align: "right" });
  doc.text("TOTAL PRICE", PAGE_MARGIN + COLUMNS.total, headerTextY, { width: COLUMN_WIDTHS.total, align: "right" });

  doc.y = headerY + headerHeight;
  doc.moveDown(1.1);

  order.items.forEach((item) => {
    const rowY = doc.y;
    doc.font(FONT_BOLD).fontSize(10).fillColor(COLORS.text).text(item.name, PAGE_MARGIN + 12 + COLUMNS.item, rowY, {
      width: COLUMN_WIDTHS.item - 12,
    });
    if (item.sku) {
      doc.font(FONT).fontSize(8).fillColor(COLORS.accent).text(item.sku, PAGE_MARGIN + 12 + COLUMNS.item, doc.y + 2, {
        width: COLUMN_WIDTHS.item - 12,
      });
    }
    const rowBottomLeft = doc.y;

    doc.font(FONT).fontSize(10).fillColor(COLORS.text);
    doc.text(String(item.quantity), PAGE_MARGIN + COLUMNS.qty, rowY, { width: COLUMN_WIDTHS.qty, align: "right" });
    doc.text(formatMoney(item.unit_price), PAGE_MARGIN + COLUMNS.unitPrice, rowY, { width: COLUMN_WIDTHS.unitPrice, align: "right" });
    doc.text(formatMoney(item.unit_price * item.quantity), PAGE_MARGIN + COLUMNS.total, rowY, {
      width: COLUMN_WIDTHS.total,
      align: "right",
    });

    doc.y = Math.max(rowBottomLeft, doc.y);
    doc.moveDown(0.85);
    doc
      .strokeColor(COLORS.border)
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .stroke();
    doc.moveDown(0.85);
  });

  doc.fillColor(COLORS.text);
}

function drawPaymentAndTotals(doc, order) {
  const startY = doc.y;
  const halfWidth = CONTENT_WIDTH / 2 - 14;
  const rightX = PAGE_MARGIN + halfWidth + 28;

  doc.font(FONT_BOLD).fontSize(9).fillColor(COLORS.muted).text("PAYMENT INFORMATION", PAGE_MARGIN, startY);
  doc.font(FONT).fontSize(10).fillColor(COLORS.text);
  if (order.payment) {
    const brand = order.payment.card_brand
      ? order.payment.card_brand.charAt(0).toUpperCase() + order.payment.card_brand.slice(1)
      : "Card";
    doc.text(`${brand} Ending in ${order.payment.card_last4 ?? "----"}`, PAGE_MARGIN, doc.y + 7);
    doc.fillColor(COLORS.muted).fontSize(9).text("Processed via Secure Gateway", PAGE_MARGIN, doc.y + 3);
  } else {
    doc.fillColor(COLORS.muted).text("No payment recorded yet.");
  }
  const leftBottomY = doc.y;

  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  let rowY = startY;
  const totalsRows = [
    ["Subtotal (incl. GST)", formatMoney(order.subtotal)],
    ["GST Included", formatMoney(order.tax_amount)],
    [isPickup ? "Pickup" : "Shipping", formatMoney(order.shipping_cost)],
  ];
  const labelWidth = 130;
  const valueWidth = 95;
  totalsRows.forEach(([label, value]) => {
    doc.font(FONT).fontSize(10).fillColor(COLORS.muted).text(label, rightX, rowY, { width: labelWidth });
    doc
      .font(FONT_BOLD)
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(value, rightX + labelWidth, rowY, { width: valueWidth, align: "right" });
    rowY += 19;
  });
  rowY += 4;
  doc
    .strokeColor(COLORS.border)
    .moveTo(rightX, rowY)
    .lineTo(rightX + labelWidth + valueWidth, rowY)
    .stroke();
  rowY += 12;
  doc.font(FONT_BOLD).fontSize(11).fillColor(COLORS.accent).text("Total Amount", rightX, rowY, { width: labelWidth });
  doc.fontSize(14).text(formatMoney(order.total), rightX + labelWidth, rowY - 2, { width: valueWidth, align: "right" });

  doc.fillColor(COLORS.text);
  doc.y = Math.max(leftBottomY, rowY + 26);
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

function buildInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, order);
    drawPartiesBlock(doc, order);
    drawItemsTable(doc, order);
    drawPaymentAndTotals(doc, order);
    drawCardBorder(doc, doc.y);

    doc.end();
  });
}

module.exports = { buildInvoicePdfBuffer };
