// utils/pdf/invoicePdf.js
//
// Renders a Tax Invoice PDF for an order, generated server-side with pdfkit
// since this is headless (an email attachment), not the browser's print
// dialog. Palette, fonts, layout and field order are kept in lockstep with
// the dashboard's InvoicePrintView.tsx (the "Print Invoice" button) — same
// light theme, same rules, same sections — so the emailed PDF and the
// printed copy never disagree.
//
// Layout language, mirroring that component: a heavy rule under the
// letterhead, a hairline-divided meta strip for the four transaction facts,
// Ship To / Bill To pushed to opposite edges, a hairline-ruled items table,
// and a solid ink bar for the grand total. There are no icons anywhere in
// this design (the previous revision hand-traced lucide glyphs to match the
// old icon-led layout — all of that machinery is gone with it), and data
// values are set in Courier so figures, dates and reference numbers align
// column-to-column exactly as the monospace face does in the browser.

const path = require("path");
const PDFDocument = require("pdfkit");
const { ORDER_DELIVERY_METHOD } = require("../../constants/order.constants");
const { formatOrderNumber, formatInvoiceNumber } = require("../orderNumberFormat");
const { stripEbayAddressPrefix } = require("../addressFormat");

const PAGE_WIDTH = 595.28; // A4 points
const PAGE_HEIGHT = 841.89; // A4 points
const PAGE_MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const CONTENT_RIGHT = PAGE_MARGIN + CONTENT_WIDTH;
// Space reserved at the foot of every page for the printed-at / page-count
// rule, which is stamped onto each page after all content is laid out.
const PAGE_RULE_RESERVE = 46;
const BOTTOM_LIMIT = PAGE_HEIGHT - PAGE_MARGIN - PAGE_RULE_RESERVE;

const LOGO_PATH = path.join(__dirname, "../../assets/branding/logo.png");
const LOGO_SIZE = 36;
const LOGO_TEXT_GAP = 10;

// Headings and names are the only proportional type on the sheet, and
// they're all set bold — the regular weight went unused with the redesign.
const FONT_BOLD = "Helvetica-Bold";
// Courier is the only monospace in pdfkit's standard 14 (no font file is
// shipped or embedded), and it's what stands in for the browser's
// ui-monospace stack in InvoicePrintView.tsx.
const MONO = "Courier";
const MONO_BOLD = "Courier-Bold";

// Same hex values as InvoicePrintView.tsx's INK/MUTED/ACCENT/BORDER/GREEN,
// plus the lighter gold that the grand-total figure uses on the ink bar
// (the accent itself is too dark to read against it).
const COLORS = {
  text: "#18140f",
  muted: "#6b6f7a",
  accent: "#c2790b",
  border: "#e2e0da",
  white: "#ffffff",
  green: "#15803d",
  goldOnInk: "#e0a83a",
};

// Column starts/widths sum to CONTENT_WIDTH — seven columns: a row-number
// column plus GST/Qty/Discount each broken out as their own correctly-
// labeled column (order.tax_amount is only ever an order-level figure, so it
// can't answer "what's the GST on this specific line"). The numeric columns
// are sized for Courier, which is appreciably wider per character than the
// proportional face the labels are set in.
const COLUMNS = { number: 0, item: 22, unitPrice: 186, gst: 256, qty: 326, discount: 352, total: 422 };
const COLUMN_WIDTHS = { number: 18, item: 160, unitPrice: 66, gst: 66, qty: 22, discount: 66, total: 65 };
// Point size the table's figures are set at: 14 Courier characters
// ("A$1,234,567.89", the widest amount the columns above are budgeted for)
// measure 63pt here, inside even the narrowest numeric column.
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

// ─── Primitives ──────────────────────────────────────────────────────────

// Right-aligns `text` against `rightEdgeX` using the CURRENTLY set
// font/fontSize/fillColor, with no `width` passed to .text() at all — a
// width constraint is what makes pdfkit wrap, and `{ lineBreak: false }`
// alone does not reliably suppress that (confirmed: a 5-figure total still
// wrapped with it set). Measuring the string and positioning it directly is
// the only fix that's actually guaranteed not to wrap, regardless of how
// large the number gets.
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

// Joins `parts` with a middot onto as few lines as fit within `width`,
// packing greedily rather than letting pdfkit wrap the joined string — a
// plain wrap breaks at the space *after* a separator and strands a dangling
// "·" at the end of the line. Returns the y below the last line drawn.
function drawSeparatedParts(doc, parts, x, y, width, separator = "  ·  ") {
  const lines = [];
  parts.forEach((part) => {
    const current = lines[lines.length - 1];
    const candidate = current === undefined ? part : `${current}${separator}${part}`;
    if (current !== undefined && doc.widthOfString(candidate) <= width) lines[lines.length - 1] = candidate;
    else lines.push(part);
  });
  let cursor = y;
  lines.forEach((line) => {
    doc.text(line, x, cursor, { width, lineBreak: false });
    cursor = doc.y + 1;
  });
  return cursor;
}

// Small-caps, wide-tracked section label in the accent color — "SHIP TO",
// "PAYMENT DETAILS", "WARRANTY & RETURNS". Mirrors InvoicePrintView.tsx's
// <SectionLabel>. Returns the y the block's content should start at.
function drawSectionLabel(doc, label, x, y, { width = CONTENT_WIDTH, align = "left", color = COLORS.accent } = {}) {
  doc
    .font(FONT_BOLD)
    .fontSize(6.5)
    .fillColor(color)
    .text(label.toUpperCase(), x, y, { width, align, characterSpacing: 1.1 });
  return y + 11;
}

// Tiny caps label stacked above a monospace value — the meta strip's cells
// and the bank-details grid both use this pairing (InvoicePrintView.tsx's
// <MetaCell>/<FieldBlock>). Returns the y below the value.
function drawLabelledValue(doc, label, value, x, y, width, { labelSize = 6, valueSize = 8, valueFont = MONO } = {}) {
  doc
    .font(FONT_BOLD)
    .fontSize(labelSize)
    .fillColor(COLORS.muted)
    .text(label.toUpperCase(), x, y, { width, characterSpacing: 0.9 });
  const valueY = y + labelSize + 4;
  doc.font(valueFont).fontSize(valueSize).fillColor(COLORS.text).text(value, x, valueY, { width });
  return valueY + valueSize + 3;
}

// ─── Sections ────────────────────────────────────────────────────────────

function drawLetterhead(doc, order, companyProfile) {
  const top = PAGE_MARGIN;
  const textX = PAGE_MARGIN + LOGO_SIZE + LOGO_TEXT_GAP;
  // The right-hand block only ever holds "TAX INVOICE" over an invoice
  // number, so it needs far less room than the letterhead.
  const rightWidth = 110;
  const rightX = CONTENT_RIGHT - rightWidth;
  // Width available to the company name, which sits on the same line as
  // "TAX INVOICE" and so has to stop short of it.
  const nameWidth = CONTENT_WIDTH - LOGO_SIZE - LOGO_TEXT_GAP - rightWidth - 16;

  // Drawn before the letterhead so the address/contact lines below can be
  // flowed at full width, starting beneath this block rather than beside it
  // — a tenant's phone + email + ABN on one line is wider than what's left
  // of the sheet next to an invoice number.
  doc
    .font(FONT_BOLD)
    .fontSize(7)
    .fillColor(COLORS.accent)
    .text("TAX INVOICE", rightX, top + 2, { width: rightWidth, align: "right", characterSpacing: 2.2 });
  doc.font(MONO_BOLD).fontSize(16).fillColor(COLORS.text);
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
  // Phone / email / ABN collapse onto one line separated by middots — only
  // the parts the tenant has actually filled in.
  const contactParts = [companyProfile.phone, companyProfile.email, companyProfile.abn ? `ABN ${companyProfile.abn}` : null].filter(
    Boolean,
  );
  const contactLine = contactParts.join(" · ");

  // These two lines sit tucked under the company name where they fit beside
  // the invoice-number block, and drop below it — across the full width left
  // of the logo — only when a tenant's own details are too long to clear it.
  // (Constraining them to the narrow column instead would wrap an address or
  // an email onto a second line for no reason.)
  doc.font(MONO).fontSize(7.5);
  const fitsBeside = doc.widthOfString(addressLine) <= nameWidth && doc.widthOfString(contactLine) <= nameWidth;
  const detailWidth = fitsBeside ? nameWidth : CONTENT_WIDTH - LOGO_SIZE - LOGO_TEXT_GAP;
  const detailY = fitsBeside ? doc.y + 3 : Math.max(doc.y + 3, rightBottom + 6);

  doc.fillColor(COLORS.text).text(addressLine, textX, detailY, { width: detailWidth });
  doc.font(MONO).fontSize(7.5).fillColor(COLORS.muted);
  const leftBottom = drawSeparatedParts(doc, contactParts, textX, doc.y + 1, detailWidth, " · ");

  const ruleY = Math.max(leftBottom, top + LOGO_SIZE) + 14;
  drawRule(doc, ruleY, { color: COLORS.text, thickness: 2.5 });
  doc.fillColor(COLORS.text);
  return ruleY;
}

// The four facts a reader actually looks up, in equal hairline-divided
// cells directly under the letterhead rule.
function drawMetaStrip(doc, order, topY) {
  const cells = [
    ["Invoice Date", formatDate(order.created_at)],
    ["Due Date", "Upon receipt"],
    ["Order Number", order.reference_number || formatOrderNumber(order.order_number_prefix, order.order_number)],
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

// Ship To (left) and Bill To (right) pushed to opposite edges of the sheet,
// each block aligned to its own edge.
function drawPartiesBlock(doc, order, topY) {
  const colWidth = 215;
  const startY = topY + 20;
  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  const billingAddress = order.billing_address || order.shipping_address;
  // Company name takes over the customer's name slot on the invoice when set.
  const displayName = order.customer.company_name || order.customer.name;

  const shipLines =
    isPickup || !order.shipping_address
      ? ["Collecting in-store, see seller address above."]
      : [
          stripEbayAddressPrefix(order.shipping_address.address),
          `${order.shipping_address.suburb} ${order.shipping_address.state} ${order.shipping_address.postcode}`,
        ];
  const billLines = [
    billingAddress ? stripEbayAddressPrefix(billingAddress.address) : null,
    billingAddress ? `${billingAddress.suburb} ${billingAddress.state} ${billingAddress.postcode}, Australia` : null,
    order.customer.phone ? `PH: ${order.customer.phone}` : null,
    order.customer.email ? `EMAIL: ${order.customer.email}` : null,
  ].filter(Boolean);

  const shipBottom = drawPartyColumn(doc, "Ship To", displayName, shipLines, PAGE_MARGIN, startY, colWidth, "left");
  const billBottom = drawPartyColumn(doc, "Bill To", displayName, billLines, CONTENT_RIGHT - colWidth, startY, colWidth, "right");

  doc.fillColor(COLORS.text);
  return Math.max(shipBottom, billBottom);
}

function drawPartyColumn(doc, label, displayName, lines, x, y, width, align) {
  let cursor = drawSectionLabel(doc, label, x, y, { width, align });
  doc
    .font(FONT_BOLD)
    .fontSize(9.5)
    .fillColor(COLORS.text)
    .text(displayName.toUpperCase(), x, cursor + 3, { width, align, characterSpacing: -0.2 });
  cursor = doc.y + 5;
  doc.font(MONO).fontSize(7.5).fillColor(COLORS.muted);
  lines.forEach((line) => {
    doc.text(line, x, cursor, { width, align });
    cursor = doc.y + 1.5;
  });
  return cursor;
}

const TABLE_HEADER_HEIGHT = 20;

function drawItemsTableHeader(doc, y) {
  drawRule(doc, y);
  const headerTextY = y + 8;
  doc.font(FONT_BOLD).fontSize(6.5).fillColor(COLORS.muted);
  const spacing = { characterSpacing: 0.9 };
  doc.text("#", PAGE_MARGIN + COLUMNS.number, headerTextY, { width: COLUMN_WIDTHS.number, ...spacing });
  doc.text("DESCRIPTION / ITEM CODE", PAGE_MARGIN + COLUMNS.item, headerTextY, { width: COLUMN_WIDTHS.item, ...spacing });
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

// Item names wrap to however many lines they actually need — no clamp, no
// ellipsis — so a long product title is always fully readable rather than
// cut off. That means each row's height varies per item, so it's measured
// with heightOfString() up front and checked against the remaining page
// space *before* anything is drawn (see the loop below). Without that
// pre-check, a long name could blow past the page boundary mid-draw —
// pdfkit's own auto-pagination would kick in *inside* the item-name .text()
// call, but the sibling cells (price/qty/discount/total) are drawn
// afterwards at that same pre-computed rowY, now meaningless on whatever
// page it auto-added, scattering a single row's columns across two or more
// pages.
const ROW_PAD_TOP = 9;
const ROW_PAD_BOTTOM = 9;

function estimateItemRowHeight(doc, item) {
  doc.font(FONT_BOLD).fontSize(9.5);
  let height = doc.heightOfString(item.name, { width: COLUMN_WIDTHS.item });
  if (item.sku) {
    doc.font(MONO).fontSize(7);
    height += 2 + doc.currentLineHeight();
  }
  return height + ROW_PAD_TOP + ROW_PAD_BOTTOM;
}

function drawItemRow(doc, item, index, y) {
  const textY = y + ROW_PAD_TOP;

  doc
    .font(MONO)
    .fontSize(FIGURE_SIZE)
    .fillColor(COLORS.muted)
    .text(String(index + 1).padStart(2, "0"), PAGE_MARGIN + COLUMNS.number, textY, { width: COLUMN_WIDTHS.number });

  doc.font(FONT_BOLD).fontSize(9.5).fillColor(COLORS.text);
  const nameHeight = doc.heightOfString(item.name, { width: COLUMN_WIDTHS.item });
  doc.text(item.name, PAGE_MARGIN + COLUMNS.item, textY, { width: COLUMN_WIDTHS.item });
  let leftBottom = textY + nameHeight;
  if (item.sku) {
    doc
      .font(MONO)
      .fontSize(7)
      .fillColor(COLORS.muted)
      .text(`SKU ${item.sku}`, PAGE_MARGIN + COLUMNS.item, leftBottom + 2, { width: COLUMN_WIDTHS.item });
    leftBottom = doc.y;
  }

  const discount = item.discount_amount || 0;
  const lineTotal = item.unit_price * item.quantity - discount;

  doc.font(MONO).fontSize(FIGURE_SIZE).fillColor(COLORS.text);
  drawRightAligned(doc, formatMoney(lineExclusiveUnitPrice(item.unit_price)), PAGE_MARGIN + COLUMNS.unitPrice + COLUMN_WIDTHS.unitPrice, textY);
  drawRightAligned(doc, formatMoney(lineGst(lineTotal)), PAGE_MARGIN + COLUMNS.gst + COLUMN_WIDTHS.gst, textY);
  drawRightAligned(doc, String(item.quantity), PAGE_MARGIN + COLUMNS.qty + COLUMN_WIDTHS.qty, textY);
  // A real deduction is called out in the accent color and signed, exactly
  // as InvoicePrintView.tsx renders it; a zero stays muted and unsigned.
  doc.fillColor(discount > 0 ? COLORS.accent : COLORS.muted);
  drawRightAligned(doc, discount > 0 ? `-${formatMoney(discount)}` : formatMoney(0), PAGE_MARGIN + COLUMNS.discount + COLUMN_WIDTHS.discount, textY);
  doc.font(MONO_BOLD).fillColor(COLORS.text);
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

// Worst case: the bank-details grid + note + stamp on the left (~185), or
// the totals ledger on the right — up to 5 rows when a discount applies
// (~90) + the ink total bar (46) + paid/refunded/due rows (~54) + the
// balance-outstanding bar (30) — whichever's taller, plus a safety margin.
// Every draw call below uses an *absolute* y, not pdfkit's auto-flowing
// cursor, so if that math starts beyond the page's bottom margin, pdfkit
// silently pushes each individual call onto its own new (mostly blank) page
// instead of raising an error — this pre-check is what avoids that,
// mirroring drawItemsTable's own per-row overflow check above.
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
  // Two cells per row, with each row starting below the *measured* bottom of
  // the one above it — a long account name wraps to two lines, and a fixed
  // row pitch would let the next row's label run into it.
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

  const noteRuleY = gridBottom + 10;
  drawRule(doc, noteRuleY, { x, width });
  const invoiceLabel = formatInvoiceNumber(order.invoice_number_prefix, order.invoice_number);
  const note =
    totalPaidCents > 0
      ? `Payment received via ${channelLabelFor(order)}. No further action required, quote ${invoiceLabel} for any enquiry about this order.`
      : `No payment recorded yet, quote ${invoiceLabel} when settling this invoice.`;
  doc.font(MONO).fontSize(7).fillColor(COLORS.muted).text(note, x, noteRuleY + 9, { width, lineGap: 1.5 });

  // Outlined status stamp: the settled/unsettled state of the invoice, and
  // the channel it was taken through.
  const stampY = doc.y + 12;
  const isPaid = totalPaidCents > 0;
  const stampColor = isPaid ? COLORS.green : COLORS.accent;
  const stampLabel = isPaid ? "PAID" : "UNPAID";
  const channelText = channelLabelFor(order).toUpperCase();
  doc.font(FONT_BOLD).fontSize(13);
  const stampLabelWidth = doc.widthOfString(stampLabel);
  doc.font(MONO).fontSize(7);
  const channelWidth = doc.widthOfString(channelText, { characterSpacing: 0.8 });
  const stampWidth = stampLabelWidth + channelWidth + 30;
  const stampHeight = 24;
  doc.roundedRect(x, stampY, stampWidth, stampHeight, 2).lineWidth(1).strokeColor(stampColor).stroke();
  doc.font(FONT_BOLD).fontSize(13).fillColor(stampColor).text(stampLabel, x + 10, stampY + 6);
  doc
    .font(MONO)
    .fontSize(7)
    .fillColor(COLORS.muted)
    .text(channelText, x + 10 + stampLabelWidth + 10, stampY + 10, { characterSpacing: 0.8, lineBreak: false });

  return stampY + stampHeight;
}

// One line of the totals ledger — label left, figure right. `tone` picks the
// emphasis: plain ink for a running figure, accent for a deduction, green
// for a settled balance (same three tones as InvoicePrintView.tsx's
// <TotalRow>).
function drawTotalRow(doc, label, value, x, y, width, tone = "default") {
  const color = tone === "accent" ? COLORS.accent : tone === "green" ? COLORS.green : COLORS.text;
  doc
    .font(MONO)
    .fontSize(8)
    .fillColor(tone === "default" ? COLORS.muted : color)
    .text(label, x, y, { width, lineBreak: false });
  doc.font(MONO).fontSize(8).fillColor(color);
  drawRightAligned(doc, value, x + width, y);
  return y + 14;
}

function drawTotals(doc, order, totalPaidCents, totalRefundedCents, x, y, width) {
  const isPickup = order.delivery_method === ORDER_DELIVERY_METHOD.PICKUP;
  // Item-level discounts plus any legacy order-level discount (see Order.js's
  // discount_amount comment) — order.subtotal already nets these out.
  const itemDiscount = order.items.reduce((sum, i) => sum + (i.discount_amount || 0), 0);
  const totalDiscount = itemDiscount + (order.discount_amount || 0);
  // order.tax_amount is the authoritative GST embedded in order.subtotal
  // (computed once, at order-creation time, from the POST-discount
  // subtotal — order.service.js#GST_DIVISOR) — reused directly here rather
  // than recomputed, so this invoice can never disagree with the rest of the
  // app about how much GST an order actually carries. Ex-GST subtotal is
  // just that subtotal with its own GST subtracted back out.
  const gstAmount = order.tax_amount || 0;
  const exGstSubtotal = order.subtotal - gstAmount;

  let cursor = y;
  // Pre-discount figure + the discount itself only earn a line when there
  // actually is a discount — an order with none goes straight from
  // Subtotal (ex GST) to GST to Pickup/Freight, matching a clean invoice
  // with nothing to net out.
  if (totalDiscount > 0) {
    cursor = drawTotalRow(doc, "Subtotal", formatMoney(order.subtotal + totalDiscount), x, cursor, width);
    cursor = drawTotalRow(doc, "Discount", `-${formatMoney(totalDiscount)}`, x, cursor, width, "accent");
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
  doc.font(MONO_BOLD).fontSize(10).fillColor(COLORS.goldOnInk);
  drawRightAligned(doc, formatMoney(order.total), x + width - 12, barY + 10);
  cursor = barY + barHeight + 10;

  // A refund does NOT always mean "nothing more is owed" — see
  // utils/paymentTotals.ts#getBalanceDue (the frontend twin of this logic)
  // for the full reasoning: paid-in-full-then-refunded means due is 0
  // regardless of the raw remainder, but never-paid-in-full-then-refunded-
  // on-top means the real shortfall is still owed. totalPaidCents is already
  // net of refunds, so totalPaidCents + totalRefundedCents reconstructs the
  // gross amount ever collected.
  const grossPaidCents = (totalPaidCents || 0) + (totalRefundedCents || 0);
  const wasEverPaidInFull = grossPaidCents >= order.total;
  const isFullyRefunded = order.status === "refunded";
  const amountDue = wasEverPaidInFull || isFullyRefunded ? 0 : Math.max(0, order.total - (totalPaidCents || 0));

  // Total paid / Total due are always shown, even at $0 — same convention as
  // the totals rows above.
  cursor = drawTotalRow(doc, "Total paid", formatMoney(totalPaidCents || 0), x, cursor, width);
  if (totalRefundedCents > 0) {
    cursor = drawTotalRow(doc, "Total refunded", formatMoney(totalRefundedCents), x, cursor, width);
  }
  cursor = drawTotalRow(doc, "Total due", formatMoney(amountDue), x, cursor, width, amountDue === 0 ? "green" : "accent");

  // Every channel can now carry an outstanding balance — storefront/eBay
  // prices are editable after the fact (see updateOrderItemPrice), not just
  // manual sales — mirroring InvoicePrintView.tsx's generalized Balance
  // Outstanding treatment. getBalanceDue already correctly returns 0 for an
  // order that was paid in full before being refunded, so no separate
  // refunded-status check is needed here.
  if (amountDue > 0) {
    const barTop = cursor + 6;
    const outstandingHeight = 26;
    doc.rect(x, barTop, width, outstandingHeight).fill(COLORS.accent);
    doc
      .font(FONT_BOLD)
      .fontSize(6)
      .fillColor(COLORS.white)
      .text("BALANCE OUTSTANDING", x + 10, barTop + 10, { characterSpacing: 0.9, lineBreak: false });
    doc.font(MONO_BOLD).fontSize(9).fillColor(COLORS.white);
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

// Warranty & Returns / Legal Disclaimer, set as two plain hairline-topped
// columns — matching InvoicePrintView.tsx's footer, which pins itself to the
// bottom of the sheet with `mt-auto`.
function drawFooter(doc, companyProfile, topY) {
  // pdfkit's .text() auto-paginates against the page's own bottom margin
  // even when given an explicit y below it (the same quirk drawPageRule
  // works around) — this function's own pinning math is what decides where
  // the footer sits, so pdfkit's independent check has to be disabled for
  // the duration of this draw, or a well-placed final line could silently
  // trigger an extra near-blank page. Restored at the end.
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  const colGap = 26;
  const colWidth = (CONTENT_WIDTH - colGap) / 2;
  const lineGap = 1.4;
  // Free-text fields are authored as separate lines in Settings; the footer
  // sets them as a single flowing paragraph, so the lines are rejoined
  // rather than rendered as a list (same as InvoicePrintView.tsx).
  const warrantyText =
    (companyProfile.warranty_text || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .join(" ") || "—";
  const legalText = companyProfile.legal_disclaimer_text || "—";

  doc.font(MONO).fontSize(7);
  const bodyHeight = Math.max(
    doc.heightOfString(warrantyText, { width: colWidth, lineGap }),
    doc.heightOfString(legalText, { width: colWidth, lineGap }),
  );
  const blockHeight = 11 + 6 + bodyHeight;

  // Always pinned to the foot of whichever page it lands on, like
  // InvoicePrintView.tsx's `mt-auto` footer — including a page added just
  // for it, which it would otherwise start at the top of, leaving the rest
  // of the sheet blank beneath it. It only sits higher than the foot when
  // the preceding content reaches that far down the page itself.
  let anchorY = topY + 26;
  if (anchorY + blockHeight > BOTTOM_LIMIT) {
    doc.addPage();
    anchorY = PAGE_MARGIN;
  }
  const ruleY = Math.max(anchorY, BOTTOM_LIMIT - blockHeight);

  drawRule(doc, ruleY);
  const textY = ruleY + 10;
  const col2X = PAGE_MARGIN + colWidth + colGap;
  drawSectionLabel(doc, "Warranty & Returns", PAGE_MARGIN, textY, { width: colWidth });
  drawSectionLabel(doc, "Legal Disclaimer", col2X, textY, { width: colWidth });
  doc.font(MONO).fontSize(7).fillColor(COLORS.muted).text(warrantyText, PAGE_MARGIN, textY + 13, { width: colWidth, lineGap });
  doc.font(MONO).fontSize(7).fillColor(COLORS.muted).text(legalText, col2X, textY + 13, { width: colWidth, lineGap });

  doc.fillColor(COLORS.text);
  doc.page.margins.bottom = originalBottomMargin;
}

// The rule closing the foot of every page, carrying the page count — drawn
// after every other page's worth of content already exists (see
// buildInvoicePdfBuffer's bufferPages/switchToPage pass), since the total
// isn't known until then. InvoicePrintView.tsx closes its own sheet with the
// same rule, minus the count that only a paginated document needs.
//
// pdfkit's .text() still auto-paginates against the page's own bottom
// margin even when given explicit x/y coordinates below it — writing this
// close to PAGE_HEIGHT silently triggered doc.addPage() and put the label on
// a brand new blank page instead of the intended one. Zeroing the bottom
// margin for the duration of this one call (the standard pdfkit workaround)
// stops that check from firing.
function drawPageRule(doc, pageIndex, pageCount) {
  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  const ruleY = PAGE_HEIGHT - PAGE_MARGIN - 18;
  drawRule(doc, ruleY);
  doc.font(MONO).fontSize(6).fillColor(COLORS.muted);
  drawRightAligned(doc, `Page ${pageIndex + 1} of ${pageCount}`, CONTENT_RIGHT, ruleY + 7);
  doc.page.margins.bottom = originalBottomMargin;
}

// totalPaidCents/totalRefundedCents: sums of Payment fields for the order
// (see payment.service.js#getTotalPaidForOrder/#getTotalRefundedForOrder) —
// the caller computes these since they require a DB query this pure
// rendering function shouldn't make itself.
function buildInvoicePdfBuffer(order, { totalPaidCents = 0, totalRefundedCents = 0, companyProfile = {} } = {}) {
  return new Promise((resolve, reject) => {
    // bufferPages: true is required to go back and draw onto earlier pages
    // (switchToPage below) after later pages already exist — the total page
    // count for "Page X of Y" isn't known until every page has been drawn.
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

module.exports = { buildInvoicePdfBuffer };
