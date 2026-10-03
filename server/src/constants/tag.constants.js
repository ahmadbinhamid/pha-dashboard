// constants/tag.constants.js
// Printed tag options; mirrored by the dashboard's config/productTag.ts.

const TAG_FONT = Object.freeze({ HELVETICA: "helvetica", TIMES: "times", COURIER: "courier" });
const TAG_QR_POSITION = Object.freeze({ LEFT: "left", RIGHT: "right" });
const TAG_ALIGN = Object.freeze({ LEFT: "left", CENTER: "center" });
const TAG_LINE_SPACING = Object.freeze({ TIGHT: "tight", NORMAL: "normal", RELAXED: "relaxed" });
const TAG_PRINT_SOURCE = Object.freeze({ QUEUE: "queue", PRODUCT: "product" });
// "set" replaces the queued copies; "increment" adds to them.
const TAG_QUEUE_MODE = Object.freeze({ SET: "set", INCREMENT: "increment" });
// Common Australian direct-thermal label sizes, "widthxheight" in mm.
const TAG_SIZES = Object.freeze(["50x25", "62x29", "76x25", "76x38", "76x50", "102x25", "102x36", "102x50", "102x76"]);

// Body fields stack in the saved order; stock number and bay form the footer.
const TAG_FIELD = Object.freeze({
  TITLE: "title",
  NOTE: "note",
  STOCK_NUMBER: "stock_number",
  BAY: "bay",
});
const TAG_BODY_FIELDS = Object.freeze([TAG_FIELD.TITLE, TAG_FIELD.NOTE]);

// Guards against a typo printing a roll's worth of one tag.
const MAX_TAG_COPIES = 500;
const TAG_FONT_PT = Object.freeze({ min: 5, max: 14 });
const TAG_MARGIN_MM = Object.freeze({ min: 1, max: 4 });

const DEFAULT_TAG_FIELDS = Object.freeze([
  { key: TAG_FIELD.TITLE, visible: true, size_pt: 8, bold: true },
  { key: TAG_FIELD.NOTE, visible: true, size_pt: 6.5, bold: false },
  { key: TAG_FIELD.STOCK_NUMBER, visible: true, size_pt: 8.5, bold: true },
  { key: TAG_FIELD.BAY, visible: true, size_pt: 7.5, bold: true },
]);

const DEFAULT_TAG_STYLE = Object.freeze({
  size: "76x25",
  font: TAG_FONT.HELVETICA,
  qr_position: TAG_QR_POSITION.LEFT,
  align: TAG_ALIGN.LEFT,
  line_spacing: TAG_LINE_SPACING.NORMAL,
  margin_mm: 2,
  fields: DEFAULT_TAG_FIELDS,
});

module.exports = {
  TAG_FONT,
  TAG_QR_POSITION,
  TAG_ALIGN,
  TAG_LINE_SPACING,
  TAG_PRINT_SOURCE,
  TAG_QUEUE_MODE,
  TAG_SIZES,
  TAG_FIELD,
  TAG_BODY_FIELDS,
  MAX_TAG_COPIES,
  TAG_FONT_PT,
  TAG_MARGIN_MM,
  DEFAULT_TAG_FIELDS,
  DEFAULT_TAG_STYLE,
};
