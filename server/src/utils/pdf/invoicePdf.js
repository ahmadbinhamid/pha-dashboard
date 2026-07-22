// utils/pdf/invoicePdf.js
//
// Renders a Tax Invoice PDF for an order, mirroring the layout of the
// storefront's own invoice page (company header, bill/ship or collection
// block, items table, payment info, totals) — but drawn server-side with
// pdfkit since this is generated headlessly for an email attachment, not
// via the browser's print dialog.

const path = require("path");
const PDFDocument = require("pdfkit");
const { COMPANY_INFO, INVOICE_NOTE } = require("../../constants/company.constants");
const { ORDER_DELIVERY_METHOD } = require("../../constants/order.constants");

const PAGE_MARGIN = 50;
const COLUMNS = { sku: 0, description: 80, qty: 270, unitPrice: 320, total: 410 };
const COLUMN_WIDTHS = { sku: 70, description: 180, qty: 40, unitPrice: 80, total: 85 };
const PAGE_WIDTH = 595.28; // A4 points
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const LOGO_PATH = path.join(__dirname, "../../assets/branding/logo.png");
const LOGO_SIZE = 46;
const LOGO_TEXT_GAP = 12;

// Hex equivalents of the storefront's light-theme CSS variables (src/index.css)
// — this PDF renders on white paper, so it mirrors the light theme, not dark.
// pdfkit can't consume CSS custom properties directly, so these are the
// computed values: --fg, --fg-muted, --accent, --border under :root (light).
const COLORS = {
  text: "#1f1a14",
  muted: "#7b7065",
  accent: "#c39113",
  border: "#d8d4ca",
};

function formatMoney(cents) {
  return `A$${(cents / 100).toFixed(2)}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-AU", { year: "numeric", month: "short", day: "numeric" });
}

function drawHeader(doc, order) {
  const textX = PAGE_MARGIN + LOGO_SIZE + LOGO_TEXT_GAP;
  doc.image(LOGO_PATH, PAGE_MARGIN, PAGE_MARGIN, { width: LOGO_SIZE, height: LOGO_SIZE });

  doc.font("Helvetica-Bold").fontSize(20).text("TAX INVOICE", textX, PAGE_MARGIN);
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text(`${COMPANY_INFO.name} | ABN ${COMPANY_INFO.abn}`, textX, doc.y + 2);

  const rightX = PAGE_MARGIN + CONTENT_WIDTH - 200;
  const rows = [
    ["Invoice #", order.order_number],
    ["Date", formatDate(order.created_at)],
    ["Payment Status", order.status === "pending_payment" ? "Pending" : "Paid & Secured"],
  ];
  let y = PAGE_MARGIN;
  rows.forEach(([label, value]) => {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.muted)
      .text(label, rightX, y, { width: 90, align: "left" });
    doc
      .font("Helvetica-Bold")
      .fillColor(COLORS.text)
      .text(value, rightX + 90, y, { width: 110, align: "right" });
    y += 16;
  });

  doc.fillColor(COLORS.text);
  doc.moveDown(2);
  doc
    .strokeColor(COLORS.border)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.moveDown(1);
}

function drawAddressBlock(doc, order) {
  const startY = doc.y;
  const halfWidth = CONTENT_WIDTH / 2 - 10;

  if (order.shipping_address) {
    const billing = order.billing_address ?? order.shipping_address;
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.accent)
      .text("BILL TO", PAGE_MARGIN, startY);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(order.customer.name, PAGE_MARGIN, doc.y + 2)
      .fillColor(COLORS.muted)
      .text(billing.address)
      .text(`${billing.suburb}, ${billing.state} ${billing.postcode}`)
      .text("Australia");

    const shipY = startY;
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.accent)
      .text("SHIP TO", PAGE_MARGIN + halfWidth + 20, shipY);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(order.customer.name, PAGE_MARGIN + halfWidth + 20, shipY + 14)
      .fillColor(COLORS.muted)
      .text(order.shipping_address.address, PAGE_MARGIN + halfWidth + 20)
      .text(`${order.shipping_address.suburb}, ${order.shipping_address.state} ${order.shipping_address.postcode}`, PAGE_MARGIN + halfWidth + 20)
      .text("Australia", PAGE_MARGIN + halfWidth + 20);
  } else {
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor(COLORS.accent)
      .text("COLLECTION", PAGE_MARGIN, startY);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(COLORS.text)
      .text(order.customer.name, PAGE_MARGIN, doc.y + 2)
      .fillColor(COLORS.muted)
      .text("Customer will collect this order in-store.");
  }

  doc.fillColor(COLORS.text);
  doc.moveDown(1.5);
}

function drawItemsTable(doc, order) {
  const headerY = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.muted);
  doc.text("SKU", PAGE_MARGIN + COLUMNS.sku, headerY, { width: COLUMN_WIDTHS.sku });
  doc.text("DESCRIPTION", PAGE_MARGIN + COLUMNS.description, headerY, { width: COLUMN_WIDTHS.description });
  doc.text("QTY", PAGE_MARGIN + COLUMNS.qty, headerY, { width: COLUMN_WIDTHS.qty, align: "right" });
  doc.text("UNIT PRICE", PAGE_MARGIN + COLUMNS.unitPrice, headerY, { width: COLUMN_WIDTHS.unitPrice, align: "right" });
  doc.text("TOTAL", PAGE_MARGIN + COLUMNS.total, headerY, { width: COLUMN_WIDTHS.total, align: "right" });

  doc.moveDown(0.5);
  doc
    .strokeColor(COLORS.border)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.moveDown(0.5);

  doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
  order.items.forEach((item) => {
    const rowY = doc.y;
    doc.fillColor(COLORS.accent).text(item.sku ?? "—", PAGE_MARGIN + COLUMNS.sku, rowY, { width: COLUMN_WIDTHS.sku });
    doc.fillColor(COLORS.text).text(item.name, PAGE_MARGIN + COLUMNS.description, rowY, { width: COLUMN_WIDTHS.description });
    doc.text(String(item.quantity), PAGE_MARGIN + COLUMNS.qty, rowY, { width: COLUMN_WIDTHS.qty, align: "right" });
    doc.text(formatMoney(item.unit_price), PAGE_MARGIN + COLUMNS.unitPrice, rowY, { width: COLUMN_WIDTHS.unitPrice, align: "right" });
    doc.text(formatMoney(item.unit_price * item.quantity), PAGE_MARGIN + COLUMNS.total, rowY, {
      width: COLUMN_WIDTHS.total,
      align: "right",
    });
    doc.moveDown(0.75);
  });

  doc.moveDown(0.5);
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

  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  let rowY = startY;
  const totalsRows = [
    ["Subtotal", formatMoney(order.subtotal)],
    [isPickup ? "Pickup" : "Shipping", formatMoney(order.shipping_cost)],
  ];
  totalsRows.forEach(([label, value]) => {
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.muted).text(label, rightX, rowY, { width: 90 });
    doc.font("Helvetica-Bold").fillColor(COLORS.text).text(value, rightX + 90, rowY, { width: 110, align: "right" });
    rowY += 16;
  });
  doc
    .strokeColor(COLORS.border)
    .moveTo(rightX, rowY)
    .lineTo(rightX + 200, rowY)
    .stroke();
  rowY += 8;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.text).text("Total Amount", rightX, rowY, { width: 90 });
  doc.fontSize(14).fillColor(COLORS.accent).text(formatMoney(order.total), rightX + 90, rowY - 2, { width: 110, align: "right" });

  doc.fillColor(COLORS.text);
}

function buildInvoicePdfBuffer(order) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, order);
    drawAddressBlock(doc, order);
    drawItemsTable(doc, order);
    drawPaymentAndTotals(doc, order);

    doc.end();
  });
}

module.exports = { buildInvoicePdfBuffer };
