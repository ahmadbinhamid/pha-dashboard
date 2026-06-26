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
const ALLOWED_VIDEOS = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/avi",
  "video/mov",
];
const ALLOWED_FILES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
];
const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGES, ...ALLOWED_VIDEOS, ...ALLOWED_FILES];

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
        `File type not allowed. Allowed types: jpeg, jpg, png, webp, gif, mp4, mov, webm, avi, pdf, doc, docx, zip`,
      ),
      false,
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB (supports video)
});

const uploadSingle = upload.single("file");
const uploadMultiple = upload.array("files", 20);

module.exports = { upload, uploadSingle, uploadMultiple };
