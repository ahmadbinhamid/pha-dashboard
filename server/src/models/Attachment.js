// models/Attachment.js

const { model } = require("mongoose");
const { buildSchema } = require("./base.model");
const { buildAttachmentUrl } = require("../utils/attachment");

const attachmentSchema = buildSchema(
  {
    // Was missing entirely — every tenant's uploaded files (product photos,
    // etc.) sat in one shared, unscoped collection: the list endpoint
    // returned every tenant's attachments, and delete had no ownership
    // check at all, so any authenticated tenant could delete any other
    // tenant's files just by guessing/enumerating an id. Found live.
    // Backfilled onto every pre-existing Attachment by
    // scripts/backfillTenantId.js.
    tenant_id: { type: require("mongoose").Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
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

attachmentSchema.virtual("url").get(function () {
  return buildAttachmentUrl(this.file_name);
});

attachmentSchema.set("toJSON", { virtuals: true });
attachmentSchema.set("toObject", { virtuals: true });

module.exports = model("Attachment", attachmentSchema);
