// middlewares/upload.test.js
// Uploads: server-side extension, magic-byte check, safe /uploads headers.

const test = require("node:test");
const { before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const mongoose = require("mongoose");
const { fixtureId } = require("../testUtils/fixtureTenants");
const config = require("../config");
const app = require("../app");
const { signJwt } = require("../utils/auth/jwt");
const User = require("../models/User");
const Attachment = require("../models/Attachment");
const { seedSystemRoles } = require("../services/role.service");
const { addMember } = require("../services/membership.service");
const { auditUploads } = require("../services/uploadAudit.service");
const { SYSTEM_ROLE } = require("../constants/access.constants");

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);
const HTML = Buffer.from("<html><script>fetch('/api/v1/members')</script></html>");
const JS = Buffer.from("alert(localStorage.getItem('token'))");
const BAD_REQUEST_SHAPE = { status: "Fail", systemfailure: false, data: null };

let server;
let baseUrl;
let token;
let tenantId;
const createdFiles = [];

before(async () => {
  await mongoose.connect(config.mongoUri);
  tenantId = fixtureId();
  const suffix = crypto.randomUUID().slice(0, 8);
  await mongoose.connection.collection("tenants").insertOne({
    _id: tenantId, name: `Upload ${suffix}`, slug: `upload-${suffix}`, code: `UP${suffix}`.toUpperCase(), status: "active", deleted_at: null,
  });
  const roles = await seedSystemRoles(tenantId);
  const { insertedId } = await User.collection.insertOne({
    tenant_id: tenantId, first_name: "Up", last_name: "Loader", email: `upload-${suffix}@example.com`,
    password: "x".repeat(20), role: "user", status: "active", deleted_at: null,
  });
  await addMember({ tenantId, userId: insertedId, roleId: roles[SYSTEM_ROLE.STAFF]._id });
  token = signJwt({ sub: String(insertedId), role: "user" });
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.on("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  for (const file of createdFiles) fs.rmSync(path.join(config.uploads.dir, file), { force: true });
  server.close();
  await mongoose.disconnect();
});

const uploadsListing = () => new Set(fs.readdirSync(config.uploads.dir));

function upload(files) {
  const form = new FormData();
  for (const { bytes, type, name } of files) form.append("files", new Blob([bytes], { type }), name);
  return fetch(`${baseUrl}/api/v1/attachment`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
}

// Rejected: the existing 400 shape, and nothing new left on disk.
async function assertRejected(files, messagePattern) {
  const before = uploadsListing();
  const res = await upload(files);
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.deepEqual({ ...body, message: undefined }, { ...BAD_REQUEST_SHAPE, message: undefined });
  assert.match(body.message, messagePattern);
  assert.deepEqual([...uploadsListing()].filter((f) => !before.has(f)), [], "no rejected file left on disk");
  assert.equal(await Attachment.countDocuments({ tenant_id: tenantId, original_name: files[0].name }), 0);
}

// Writes a file straight into uploads, as a pre-fix upload would have been.
function writeUpload(ext, bytes) {
  const name = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(config.uploads.dir, name), bytes);
  createdFiles.push(name);
  return name;
}

test("an .html file declared as image/png is rejected and not left on disk", async () => {
  await assertRejected([{ bytes: HTML, type: "image/png", name: "x.html" }], /x\.html is not a valid png file/);
});

test("a spoofed .js file is rejected, as image or as script", async () => {
  await assertRejected([{ bytes: JS, type: "image/png", name: "x.js" }], /is not a valid png file/);
  await assertRejected([{ bytes: JS, type: "application/javascript", name: "x.js" }], /File type not allowed/);
});

test("one bad file rejects the whole request and removes every file it wrote", async () => {
  await assertRejected(
    [{ bytes: JPEG, type: "image/jpeg", name: "good.jpg" }, { bytes: HTML, type: "image/jpeg", name: "bad.jpg" }],
    /bad\.jpg is not a valid jpg file/,
  );
});

test("a real jpeg named .html is accepted and stored as .jpg", async () => {
  const res = await upload([{ bytes: JPEG, type: "image/jpeg", name: "x.html" }]);
  assert.equal(res.status, 201);
  const [doc] = (await res.json()).data;
  createdFiles.push(doc.file_name);
  assert.match(doc.file_name, /^[0-9a-f-]{36}\.jpg$/);
  assert.equal(doc.type, "image");
  assert.ok(fs.existsSync(path.join(config.uploads.dir, doc.file_name)));

  const served = await fetch(`${baseUrl}/uploads/${doc.file_name}`);
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), JPEG);
});

test("/uploads: images stay inline with the new headers; other files download", async () => {
  const image = await fetch(`${baseUrl}/uploads/${writeUpload(".png", PNG)}`);
  await image.arrayBuffer();
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-security-policy"), "default-src 'none'; sandbox");
  assert.equal(image.headers.get("x-content-type-options"), "nosniff");
  assert.equal(image.headers.get("cross-origin-resource-policy"), "cross-origin");
  assert.equal(image.headers.get("content-disposition"), null, "inline for the dashboard, eBay and Google");

  const pdf = await fetch(`${baseUrl}/uploads/${writeUpload(".pdf", Buffer.from("%PDF-1.4\n"))}`);
  await pdf.arrayBuffer();
  assert.equal(pdf.headers.get("content-disposition"), "attachment");
  assert.equal(pdf.headers.get("content-security-policy"), "default-src 'none'; sandbox");
});

test("/uploads: a legacy .html upload is served sandboxed, as a download", async () => {
  const res = await fetch(`${baseUrl}/uploads/${writeUpload(".html", HTML)}`);
  await res.arrayBuffer();
  assert.equal(res.status, 200, "existing URLs keep resolving");
  assert.equal(res.headers.get("content-disposition"), "attachment");
  assert.equal(res.headers.get("content-security-policy"), "default-src 'none'; sandbox");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
});

test("/uploads: an existing image URL still loads inline", async () => {
  const legacy = writeUpload(".jpeg", JPEG);
  const existing = [...uploadsListing()].find((f) => /\.(jpe?g|png|webp|gif)$/i.test(f) && !createdFiles.includes(f)) ?? legacy;
  for (const name of new Set([legacy, existing])) {
    const res = await fetch(`${baseUrl}/uploads/${name}`);
    await res.arrayBuffer();
    assert.equal(res.status, 200, name);
    assert.match(res.headers.get("content-type"), /^image\//);
    assert.equal(res.headers.get("content-disposition"), null);
  }
});

test("auditUploads flags disallowed and mislabelled files only", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upload-audit-"));
  try {
    fs.writeFileSync(path.join(dir, "good.jpg"), JPEG);
    fs.writeFileSync(path.join(dir, "evil.html"), HTML);
    fs.writeFileSync(path.join(dir, "fake.png"), JS);
    const { scanned, rows } = await auditUploads({ dir });
    assert.equal(scanned, 3);
    assert.deepEqual(
      rows.map((r) => [r.file_name, r.problem, r.attachment_id]).sort(),
      [["evil.html", "extension not on the allowlist", null], ["fake.png", "content is not png", null]],
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
