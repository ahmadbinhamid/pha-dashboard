// services/attachment.service.js

const fs = require("fs");
const crypto = require("crypto");
const Attachment = require("../models/Attachment");
const { getAttachmentType, buildAttachmentFilePath } = require("../utils/attachment");

async function listAttachments(tenantId, { skip, limit }) {
  const [items, total] = await Promise.all([
    Attachment.find({ tenant_id: tenantId }).sort({ created_at: -1 }).skip(skip).limit(limit),
    Attachment.countDocuments({ tenant_id: tenantId }),
  ]);
  return { items, total };
}

async function createAttachment(file, userId, tenantId) {
  const uid = crypto.randomUUID();
  return Attachment.create({
    tenant_id: tenantId,
    uid,
    file_name: file.filename,
    original_name: file.originalname,
    mime_type: file.mimetype,
    size: file.size,
    uploaded_by: userId,
    type: getAttachmentType(file.mimetype),
  });
}

async function findAttachment(id, tenantId) {
  return Attachment.findOne({ _id: id, tenant_id: tenantId });
}

function removeAttachmentFile(fileName) {
  if (!fileName) return;
  const diskPath = buildAttachmentFilePath(fileName);
  if (fs.existsSync(diskPath)) {
    fs.unlinkSync(diskPath);
  }
}

async function remove(attachment) {
  removeAttachmentFile(attachment.file_name);
  await attachment.softDelete();
}

module.exports = {
  listAttachments,
  createAttachment,
  findAttachment,
  removeAttachmentFile,
  remove,
};
