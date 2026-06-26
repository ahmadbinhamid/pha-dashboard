// models/Attachment.js

const { model } = require("mongoose");
const { buildSchema } = require("./base.model");
const { buildAttachmentUrl } = require("../utils/attachment");

const attachmentSchema = buildSchema(
  {
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
