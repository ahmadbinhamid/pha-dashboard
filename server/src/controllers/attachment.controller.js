// controllers/attachment.controller.js

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const Attachment = require("../models/Attachment");
const { getAttachmentType } = require("../utils/attachment");
const config = require("../config");
const {
  success,
  created,
  notFound,
  systemfailure,
} = require("../utils/http/response");

exports.upload = async (req, res) => {
  try {
    const files = req.files || (req.file ? [req.file] : []);

    if (!files || files.length === 0) {
      return systemfailure(res, new Error("No files uploaded"));
    }

    const userId = req.user?._id || null;

    const docs = await Promise.all(
      files.map(async (file) => {
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
      }),
    );

    return created(res, docs, "Files uploaded successfully");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.list = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;

    const [items, total] = await Promise.all([
      Attachment.find({}).sort({ created_at: -1 }).skip(skip).limit(limit),
      Attachment.countDocuments({}),
    ]);

    return success(res, {
      items,
      total,
      page,
      pageSize: limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.remove = async (req, res) => {
  try {
    const attachment = await Attachment.findById(req.params.id);
    if (!attachment) return notFound(res, "Attachment not found");

    if (attachment.file_name) {
      const diskPath = path.join(config.uploads.dir, attachment.file_name);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }

    await attachment.softDelete();

    return success(res, null, "Attachment deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
