// controllers/attachment.controller.js

const {
  listAttachments,
  createAttachment,
  findAttachment,
  remove,
} = require("../services/attachment.service");
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
      files.map((file) => createAttachment(file, userId)),
    );

    return created(res, docs, "Files uploaded successfully");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.list = async (req, res) => {
  try {
    const { page, limit, skip } = req.pagination;

    const { items, total } = await listAttachments({ skip, limit });

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
    const attachment = await findAttachment(req.params.id);
    if (!attachment) return notFound(res, "Attachment not found");

    await remove(attachment);

    return success(res, null, "Attachment deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};
