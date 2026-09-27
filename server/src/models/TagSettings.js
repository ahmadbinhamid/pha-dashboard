// models/TagSettings.js
// Per-tenant tag style; created with defaults on first read.

const { model, Schema } = require("mongoose");
const { buildSchema } = require("./base.model");
const {
  TAG_FONT,
  TAG_QR_POSITION,
  TAG_ALIGN,
  TAG_LINE_SPACING,
  TAG_FIELD,
  TAG_FONT_PT,
  TAG_MARGIN_MM,
  DEFAULT_TAG_STYLE,
} = require("../constants/tag.constants");

const tagFieldSchema = new Schema(
  {
    key: { type: String, enum: Object.values(TAG_FIELD), required: true },
    visible: { type: Boolean, default: true },
    size_pt: { type: Number, min: TAG_FONT_PT.min, max: TAG_FONT_PT.max, required: true },
    bold: { type: Boolean, default: false },
  },
  { _id: false },
);

const tagSettingsSchema = buildSchema(
  {
    tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true },
    font: { type: String, enum: Object.values(TAG_FONT), default: DEFAULT_TAG_STYLE.font },
    qr_position: { type: String, enum: Object.values(TAG_QR_POSITION), default: DEFAULT_TAG_STYLE.qr_position },
    align: { type: String, enum: Object.values(TAG_ALIGN), default: DEFAULT_TAG_STYLE.align },
    line_spacing: { type: String, enum: Object.values(TAG_LINE_SPACING), default: DEFAULT_TAG_STYLE.line_spacing },
    margin_mm: { type: Number, min: TAG_MARGIN_MM.min, max: TAG_MARGIN_MM.max, default: DEFAULT_TAG_STYLE.margin_mm },
    // Empty until first saved; reads fill it from defaults (and legacy flags).
    fields: { type: [tagFieldSchema], default: undefined },
  },
  { softDelete: false },
);

module.exports = model("TagSettings", tagSettingsSchema);
