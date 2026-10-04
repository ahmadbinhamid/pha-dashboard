// services/uploadAudit.service.js
// Read-only scan of the uploads dir for disallowed or mislabelled files.

const fs = require("fs/promises");
const path = require("path");
const config = require("../config");
const Attachment = require("../models/Attachment");
const { readFileHead, matchesSignature } = require("../utils/fileSignature");
const { SIGNATURE_BY_EXTENSION } = require("../constants/upload.constants");

const LOOKUP_CHUNK = 500;

// Streams the directory so a large uploads volume never loads at once.
async function scanUploads(dir) {
  const findings = [];
  let scanned = 0;
  for await (const entry of await fs.opendir(dir)) {
    if (!entry.isFile()) continue;
    scanned++;
    const ext = path.extname(entry.name).toLowerCase();
    const signature = SIGNATURE_BY_EXTENSION[ext];
    const filePath = path.join(dir, entry.name);
    let problem = null;
    if (!signature) problem = "extension not on the allowlist";
    else if (!matchesSignature(signature, await readFileHead(filePath))) problem = `content is not ${ext.slice(1)}`;
    if (!problem) continue;
    const { size, mtime } = await fs.stat(filePath);
    findings.push({ file_name: entry.name, problem, size, mtime });
  }
  return { scanned, findings };
}

// One query per chunk; soft-deleted attachments still count as a reference.
async function attachmentsByFileName(fileNames) {
  const byName = new Map();
  for (let i = 0; i < fileNames.length; i += LOOKUP_CHUNK) {
    const docs = await Attachment.find({ file_name: { $in: fileNames.slice(i, i + LOOKUP_CHUNK) } })
      .setOptions({ withDeleted: true })
      .select("file_name tenant_id original_name mime_type deleted_at")
      .lean();
    for (const doc of docs) byName.set(doc.file_name, doc);
  }
  return byName;
}

/** Disallowed or mislabelled uploads with their Attachment/tenant, if any. */
async function auditUploads({ tenantId = null, dir = config.uploads.dir } = {}) {
  const { scanned, findings } = await scanUploads(dir);
  const byName = await attachmentsByFileName(findings.map((f) => f.file_name));
  const rows = findings.map((f) => {
    const doc = byName.get(f.file_name);
    return {
      ...f,
      attachment_id: doc ? String(doc._id) : null,
      tenant_id: doc ? String(doc.tenant_id) : null,
      original_name: doc?.original_name ?? null,
      declared_mime: doc?.mime_type ?? null,
      attachment_deleted: Boolean(doc?.deleted_at),
    };
  });
  return { dir, scanned, rows: tenantId ? rows.filter((r) => r.tenant_id === String(tenantId)) : rows };
}

module.exports = { auditUploads };
