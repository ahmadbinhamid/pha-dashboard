// utils/pdf/invoicePdf.js
//
// Renders a Tax Invoice PDF for an order, generated server-side with pdfkit
// since this is headless (an email attachment), not the browser's print
// dialog. Layout follows the reference invoice mockup the client supplied
// (bordered card, icon-led detail rows, shaded table header, pill badges) —
// recoloured for a light/printable background instead of that mockup's dark
// theme. pdfkit has no SVG/icon-font support, so the small building/pin/mail
// glyphs are hand-drawn with basic vector primitives (rect/circle/line)
// rather than pulled from an icon set.

const path = require("path");
const PDFDocument = require("pdfkit");
const { COMPANY_INFO, PICKUP_LOCATION, INVOICE_NOTE } = require("../../constants/company.constants");
const { ORDER_DELIVERY_METHOD } = require("../../constants/order.constants");

const PAGE_MARGIN = 50;
const FRAME_PADDING = 16; // gap between the card border and its content
const CARD_RADIUS = 10;
const COLUMNS = { item: 0, qty: 260, unitPrice: 320, total: 410 };
const COLUMN_WIDTHS = { item: 250, qty: 50, unitPrice: 85, total: 85 };
const PAGE_WIDTH = 595.28; // A4 points
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const LOGO_PATH = path.join(__dirname, "../../assets/branding/logo.png");
const LOGO_SIZE = 46;
const LOGO_TEXT_GAP = 12;
const ICON_SIZE = 9;
const ICON_TEXT_GAP = 6;

// Hex equivalents of the storefront's light-theme CSS variables (src/index.css)
// — this PDF renders on white paper, so it mirrors the light theme, not dark.
// pdfkit can't consume CSS custom properties directly, so these are the
// computed values: --fg, --fg-muted, --accent, --border under :root (light).
const COLORS = {
  text: "#1f1a14",
  muted: "#7b7065",
  accent: "#c39113",
  border: "#d8d4ca",
  cardBorder: "#c9c2b4",
  tableHeaderBg: "#f6f3ec",
  pillBorder: "#c39113",
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
    .font(opts.font || "Helvetica")
    .fontSize(opts.fontSize || 9.5)
    .fillColor(opts.color || COLORS.muted)
    .text(text, x + ICON_SIZE + ICON_TEXT_GAP, y, { width: width - ICON_SIZE - ICON_TEXT_GAP });
  return doc.y;
}

function drawHeader(doc, order) {
  const textX = PAGE_MARGIN + LOGO_SIZE + LOGO_TEXT_GAP;
  doc.image(LOGO_PATH, PAGE_MARGIN, PAGE_MARGIN, { width: LOGO_SIZE, height: LOGO_SIZE });

  doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.text).text(`INVOICE #${order.order_number}`, textX, PAGE_MARGIN);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(`Date: ${formatDate(order.created_at)}`, textX, doc.y + 2);

  const isPaid = order.status !== "pending_payment";
  const pillLabel = isPaid ? "PAID & SECURED" : "PENDING PAYMENT";
  doc.font("Helvetica-Bold").fontSize(9);
  const pillTextWidth = doc.widthOfString(pillLabel);
  const pillPaddingX = 10;
  const pillWidth = pillTextWidth + pillPaddingX * 2;
  const pillHeight = 20;
  const pillX = PAGE_MARGIN + CONTENT_WIDTH - pillWidth;
  const pillY = PAGE_MARGIN;
  doc.roundedRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2).lineWidth(1).strokeColor(COLORS.pillBorder).stroke();
  doc.fillColor(COLORS.accent).text(pillLabel, pillX, pillY + 6, { width: pillWidth, align: "center" });

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(COLORS.muted)
    .text(`Channel: ${order.channel === "ebay" ? "eBay" : "Storefront"}`, pillX, pillY + pillHeight + 6, {
      width: pillWidth,
      align: "center",
    });

  doc.fillColor(COLORS.text);
  doc.y = Math.max(doc.y, pillY + pillHeight + 24, PAGE_MARGIN + LOGO_SIZE);
  doc.moveDown(1);
  doc
    .strokeColor(COLORS.border)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.moveDown(1);
}

function drawPartiesBlock(doc, order) {
  const startY = doc.y;
  const halfWidth = CONTENT_WIDTH / 2 - 10;
  const rightX = PAGE_MARGIN + halfWidth + 20;

  // Left column — seller
  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.accent).text("SELLER PROFILE", PAGE_MARGIN, startY);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(COMPANY_INFO.name, PAGE_MARGIN, doc.y + 4, { width: halfWidth });

  let y = doc.y + 5;
  y = iconLine(doc, drawBuildingIcon, `ABN ${COMPANY_INFO.abn}`, PAGE_MARGIN, y, halfWidth) + 4;
  y = iconLine(doc, drawPinIcon, `${PICKUP_LOCATION.address}, ${PICKUP_LOCATION.country}`, PAGE_MARGIN, y, halfWidth) + 4;
  y = iconLine(doc, drawMailIcon, COMPANY_INFO.email, PAGE_MARGIN, y, halfWidth) + 4;
  const leftBottomY = y;

  // Right column — customer
  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(COLORS.accent)
    .text(isPickup ? "CUSTOMER DETAILS" : "BILLING & DELIVERY ADDRESS", rightX, startY, { width: halfWidth });
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(COLORS.text)
    .text(order.customer.name, rightX, doc.y + 4, { width: halfWidth });

  let ry = doc.y + 5;
  if (isPickup) {
    ry = iconLine(doc, drawMailIcon, order.customer.email, rightX, ry, halfWidth) + 4;
    ry = iconLine(doc, drawPinIcon, "Collecting in-store — see seller address above.", rightX, ry, halfWidth) + 4;
  } else {
    ry =
      iconLine(
        doc,
        drawPinIcon,
        `${order.shipping_address.address}, ${order.shipping_address.suburb}, ${order.shipping_address.state} ${order.shipping_address.postcode}, Australia`,
        rightX,
        ry,
        halfWidth,
      ) + 4;
    ry = iconLine(doc, drawMailIcon, order.customer.email, rightX, ry, halfWidth) + 4;
    if (order.billing_address) {
      doc
        .font("Helvetica")
        .fontSize(8.5)
        .fillColor(COLORS.muted)
        .text(
          `Billing: ${order.billing_address.address}, ${order.billing_address.suburb}, ${order.billing_address.state} ${order.billing_address.postcode}`,
          rightX,
          ry,
          { width: halfWidth },
        );
      ry = doc.y + 4;
    }
  }
  const rightBottomY = ry;

  doc.fillColor(COLORS.text);
  doc.y = Math.max(leftBottomY, rightBottomY);
  doc.moveDown(1);
}

function drawItemsTable(doc, order) {
  const headerY = doc.y;
  const headerHeight = 22;
  doc.rect(PAGE_MARGIN, headerY, CONTENT_WIDTH, headerHeight).fill(COLORS.tableHeaderBg);

  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted);
  const headerTextY = headerY + 7;
  doc.text("ITEM SPEC & PART SKU", PAGE_MARGIN + 10 + COLUMNS.item, headerTextY, { width: COLUMN_WIDTHS.item - 10 });
  doc.text("QTY", PAGE_MARGIN + COLUMNS.qty, headerTextY, { width: COLUMN_WIDTHS.qty, align: "right" });
  doc.text("UNIT PRICE", PAGE_MARGIN + COLUMNS.unitPrice, headerTextY, { width: COLUMN_WIDTHS.unitPrice, align: "right" });
  doc.text("TOTAL PRICE", PAGE_MARGIN + COLUMNS.total, headerTextY, { width: COLUMN_WIDTHS.total, align: "right" });

  doc.y = headerY + headerHeight;
  doc.moveDown(0.75);

  order.items.forEach((item) => {
    const rowY = doc.y;
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.text).text(item.name, PAGE_MARGIN + 10 + COLUMNS.item, rowY, {
      width: COLUMN_WIDTHS.item - 10,
    });
    if (item.sku) {
      doc.font("Helvetica").fontSize(8).fillColor(COLORS.accent).text(item.sku, PAGE_MARGIN + 10 + COLUMNS.item, doc.y + 1, {
        width: COLUMN_WIDTHS.item - 10,
      });
    }
    const rowBottomLeft = doc.y;

    doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
    doc.text(String(item.quantity), PAGE_MARGIN + COLUMNS.qty, rowY, { width: COLUMN_WIDTHS.qty, align: "right" });
    doc.text(formatMoney(item.unit_price), PAGE_MARGIN + COLUMNS.unitPrice, rowY, { width: COLUMN_WIDTHS.unitPrice, align: "right" });
    doc.text(formatMoney(item.unit_price * item.quantity), PAGE_MARGIN + COLUMNS.total, rowY, {
      width: COLUMN_WIDTHS.total,
      align: "right",
    });

    doc.y = Math.max(rowBottomLeft, doc.y);
    doc.moveDown(0.5);
    doc
      .strokeColor(COLORS.border)
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
      .stroke();
    doc.moveDown(0.5);
  });

  doc.fillColor(COLORS.text);
}

function drawPaymentAndTotals(doc, order) {
  const startY = doc.y;
  const halfWidth = CONTENT_WIDTH / 2 - 10;
  const rightX = PAGE_MARGIN + halfWidth + 20;

  doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.muted).text("PAYMENT INFORMATION", PAGE_MARGIN, startY);
  doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
  if (order.payment) {
    const brand = order.payment.card_brand
      ? order.payment.card_brand.charAt(0).toUpperCase() + order.payment.card_brand.slice(1)
      : "Card";
    doc.text(`${brand} Ending in ${order.payment.card_last4 ?? "----"}`, PAGE_MARGIN, doc.y + 2);
    doc.fillColor(COLORS.muted).fontSize(9).text("Processed via Secure Gateway");
  } else {
    doc.fillColor(COLORS.muted).text("No payment recorded yet.");
  }
  doc.fontSize(9).fillColor(COLORS.muted).text(`"${INVOICE_NOTE}"`, PAGE_MARGIN, doc.y + 10, { width: halfWidth, italic: true });
  const leftBottomY = doc.y;

  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  let rowY = startY;
  const totalsRows = [
    ["Subtotal (incl. GST)", formatMoney(order.subtotal)],
    ["GST Included", formatMoney(order.tax_amount)],
    [isPickup ? "Pickup" : "Shipping", formatMoney(order.shipping_cost)],
  ];
  totalsRows.forEach(([label, value]) => {
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text(label, rightX, rowY, { width: 100 });
    doc.font("Helvetica-Bold").fillColor(COLORS.text).text(value, rightX + 100, rowY, { width: 100, align: "right" });
    rowY += 16;
  });
  doc
    .strokeColor(COLORS.border)
    .moveTo(rightX, rowY)
    .lineTo(rightX + 200, rowY)
    .stroke();
  rowY += 8;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.text).text("Total Amount", rightX, rowY, { width: 100 });
  doc.fontSize(14).fillColor(COLORS.accent).text(formatMoney(order.total), rightX + 100, rowY - 2, { width: 100, align: "right" });

  doc.fillColor(COLORS.text);
  doc.y = Math.max(leftBottomY, rowY + 20);
}

// Frames the whole invoice in a rounded-corner card, matching the reference
// mockup's bordered container — drawn last (as a stroke-only outline) so it
// simply overlays the page edges without covering any already-drawn content.
function drawCardBorder(doc, bottomY) {
  const x = PAGE_MARGIN - FRAME_PADDING;
  const y = PAGE_MARGIN - FRAME_PADDING;
  const width = CONTENT_WIDTH + FRAME_PADDING * 2;
  const height = bottomY - PAGE_MARGIN + FRAME_PADDING * 2;
  doc.roundedRect(x, y, width, height, CARD_RADIUS).lineWidth(1.25).strokeColor(COLORS.cardBorder).stroke();
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
