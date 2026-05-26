// middlewares/upload.js

const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const config = require("../config");

const uploadsDir = config.uploads.dir;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_IMAGES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
];
const ALLOWED_FILES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGES, ...ALLOWED_FILES];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uid = crypto.randomUUID();
    cb(null, `${uid}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `File type not allowed. Allowed types: jpeg, jpg, png, webp, gif, pdf, doc, docx, zip`,
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

const uploadSingle = upload.single("file");
const uploadMultiple = upload.array("files", 20);

module.exports = { upload, uploadSingle, uploadMultiple };
