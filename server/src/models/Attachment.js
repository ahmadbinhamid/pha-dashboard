// models/Attachment.js

const { model } = require("mongoose");
const { buildSchema } = require("./base.model");
const { buildAttachmentUrl } = require("../utils/attachment");

const attachmentSchema = buildSchema(
  {
    // tenant_id added after a cross-tenant leak (any tenant could enumerate/delete another's files); backfilled via scripts/backfillTenantId.js. Compound index below covers plain lookups too.
    tenant_id: { type: require("mongoose").Schema.Types.ObjectId, ref: "Tenant", required: true },
    uid: { type: String, unique: true, required: true },
    file_name: { type: String, default: null },
    original_name: { type: String, default: null },
    mime_type: { type: String, default: null },
    size: { type: Number, default: 0 },

    uploaded_by: {
      type: require("mongoose").Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: ["image", "video", "file"],
      default: "image",
    },
  },
  { softDelete: true },
);

// Covers attachment.service.js's list query: filter by tenant_id, sort by created_at desc.
attachmentSchema.index({ tenant_id: 1, created_at: -1 });

attachmentSchema.virtual("url").get(function () {
  return buildAttachmentUrl(this.file_name);
});

attachmentSchema.set("toJSON", { virtuals: true });
attachmentSchema.set("toObject", { virtuals: true });

module.exports = model("Attachment", attachmentSchema);
