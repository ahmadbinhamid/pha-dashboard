// services/attachment.service.js

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Attachment = require("../models/Attachment");
const { getAttachmentType } = require("../utils/attachment");
const config = require("../config");

async function listAttachments({ skip, limit }) {
  const [items, total] = await Promise.all([
    Attachment.find({}).sort({ created_at: -1 }).skip(skip).limit(limit),
    Attachment.countDocuments({}),
  ]);
  return { items, total };
}

async function createAttachment(file, userId) {
  const uid = crypto.randomUUID();
  return Attachment.create({
    uid,
    file_name: file.filename,
    original_name: file.originalname,
    mime_type: file.mimetype,
    size: file.size,
    uploaded_by: userId,
    type: getAttachmentType(file.mimetype),
  });
}

async function findAttachment(id) {
  return Attachment.findById(id);
}

function removeAttachmentFile(fileName) {
  if (!fileName) return;
  const diskPath = path.join(config.uploads.dir, fileName);
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
