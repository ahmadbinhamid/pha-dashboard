// middlewares/upload.js
// Multer disk uploads whose stored name and bytes are checked server-side.

const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const config = require("../config");
const { badRequest } = require("../utils/http/response");
const { httpError } = require("../utils/http/httpError");
const { fileMatchesSignature, matchesSignature } = require("../utils/fileSignature");
const {
  UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  UPLOAD_TYPE_ERROR,
  SPREADSHEET_TYPES,
} = require("../constants/upload.constants");
const { IMPORT_MAX_BYTES } = require("../constants/campaign.constants");

const uploadsDir = config.uploads.dir;
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  // fileFilter runs first, so the MIME is always in the table here.
  filename: (_req, file, cb) => {
    cb(null, `${crypto.randomUUID()}${UPLOAD_TYPES[file.mimetype].ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (Object.hasOwn(UPLOAD_TYPES, file.mimetype)) return cb(null, true);
  return cb(httpError(UPLOAD_TYPE_ERROR, 400), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_UPLOAD_BYTES } });

// req.file, req.files as an array, or req.files keyed by field.
function uploadedFiles(req) {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  return Object.values(req.files ?? {}).flat();
}

function removeFiles(files) {
  return Promise.all(files.map((f) => fs.promises.rm(f.path, { force: true })));
}

// NOTE: multer and type rejections answer with the 400 shape, not a 500.
function withBadRequestErrors(multerMiddleware) {
  return (req, res, next) =>
    multerMiddleware(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError || err.status === 400) return badRequest(res, err.message);
      return next(err);
    });
}

// Disk storage writes before we can look, so verify the bytes afterwards.
async function verifyUploadedFiles(req, res, next) {
  const files = uploadedFiles(req);
  try {
    const checks = await Promise.all(files.map((f) => fileMatchesSignature(f.path, UPLOAD_TYPES[f.mimetype].signature)));
    const rejected = files.find((_, i) => !checks[i]);
    if (!rejected) return next();
    await removeFiles(files);
    return badRequest(res, `${rejected.originalname} is not a valid ${UPLOAD_TYPES[rejected.mimetype].ext.slice(1)} file.`);
  } catch (err) {
    await removeFiles(files);
    return next(err);
  }
}

/** Every file route uses this: multer, then content verification. */
function uploadFiles(field, maxCount = MAX_UPLOAD_FILES) {
  return [withBadRequestErrors(upload.array(field, maxCount)), verifyUploadedFiles];
}

const uploadMultiple = uploadFiles("files");

const extensionOf = (name) => String(name || "").toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";

const spreadsheetFilter = (_req, file, cb) => {
  const type = SPREADSHEET_TYPES[extensionOf(file.originalname)];
  if (type?.mimes.includes(file.mimetype)) return cb(null, true);
  return cb(httpError("Upload an .xlsx or .csv spreadsheet", 400), false);
};

// CSV has no magic bytes; a NUL in the head means it is really binary.
function spreadsheetBytesOk(file) {
  const { signature } = SPREADSHEET_TYPES[extensionOf(file.originalname)];
  const head = file.buffer.subarray(0, 16);
  return signature ? matchesSignature(signature, head) : !head.includes(0);
}

function verifySpreadsheet(req, res, next) {
  if (!req.file) return badRequest(res, "Attach a spreadsheet to import");
  if (!spreadsheetBytesOk(req.file)) return badRequest(res, `${req.file.originalname} is not a valid spreadsheet.`);
  return next();
}

const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: spreadsheetFilter,
  limits: { fileSize: IMPORT_MAX_BYTES, files: 1 },
});

/** One in-memory spreadsheet under `field`, content-checked like uploads. */
function uploadSpreadsheet(field = "file") {
  return [withBadRequestErrors(spreadsheetUpload.single(field)), verifySpreadsheet];
}

module.exports = { upload, uploadFiles, uploadMultiple, uploadSpreadsheet, verifyUploadedFiles };
