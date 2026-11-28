// services/seo/redirect.service.js
// Storefront redirects: staff CRUD and the server-side path lookup.

const Redirect = require("../../models/Redirect");
const { httpError } = require("../../utils/http/httpError");
const { duplicateKeyField } = require("../../utils/duplicateKey");
const { buildAllWordsSearchAnd } = require("../../utils/regex");
const { PROTECTED_PATH_PREFIXES } = require("../../constants/seo.constants");

/** "/Old-Page/?utm=x" and "old-page" both become "/old-page". */
function normalizePath(raw) {
  let path = String(raw || "").trim();
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    // Not a URL after all; treat it as a path.
  }
  path = path.split(/[?#]/)[0].toLowerCase();
  if (!path.startsWith("/")) path = `/${path}`;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** Store paths are normalised too; external URLs are kept verbatim. */
const normalizeTarget = (raw) => (/^https?:\/\//i.test(String(raw).trim()) ? String(raw).trim() : normalizePath(raw));

function assertRedirectable(from, to) {
  if (from === "/") throw httpError("The home page can't be redirected", 422);
  if (PROTECTED_PATH_PREFIXES.some((p) => from === p || from.startsWith(`${p}/`))) {
    throw httpError(`${from} is used by checkout or the site itself and can't be redirected`, 422);
  }
  if (from === to) throw httpError("A redirect can't point to itself", 422);
}

/** Rejects A→B when B→A exists, which would bounce shoppers forever. */
async function assertNoLoop(tenantId, from, to, excludeId) {
  const loop = await Redirect.exists({ tenant_id: tenantId, from_path: to, to_path: from, ...(excludeId && { _id: { $ne: excludeId } }) });
  if (loop) throw httpError(`${to} already redirects back to ${from}`, 422);
}

function duplicateError(err, from) {
  return duplicateKeyField(err) === "from_path" ? httpError(`${from} already has a redirect`, 409) : err;
}

async function listRedirects(tenantId, { skip = 0, limit = 25, search } = {}) {
  const filter = { tenant_id: tenantId };
  const words = buildAllWordsSearchAnd(["from_path", "to_path"], search);
  if (words.length) filter.$and = words;
  const [items, total] = await Promise.all([
    Redirect.find(filter).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Redirect.countDocuments(filter),
  ]);
  return { items, total };
}

async function createRedirect(tenantId, { from_path, to_path, type }) {
  const from = normalizePath(from_path);
  const to = normalizeTarget(to_path);
  assertRedirectable(from, to);
  await assertNoLoop(tenantId, from, to);
  try {
    return (await Redirect.create({ tenant_id: tenantId, from_path: from, to_path: to, type })).toObject();
  } catch (err) {
    throw duplicateError(err, from);
  }
}

async function updateRedirect(id, tenantId, patch) {
  const current = await Redirect.findOne({ _id: id, tenant_id: tenantId }).lean();
  if (!current) throw httpError("Redirect not found", 404);
  const from = patch.from_path !== undefined ? normalizePath(patch.from_path) : current.from_path;
  const to = patch.to_path !== undefined ? normalizeTarget(patch.to_path) : current.to_path;
  assertRedirectable(from, to);
  await assertNoLoop(tenantId, from, to, current._id);
  try {
    const $set = { from_path: from, to_path: to, ...(patch.type && { type: patch.type }) };
    return await Redirect.findOneAndUpdate({ _id: id, tenant_id: tenantId }, { $set }, { new: true }).lean();
  } catch (err) {
    throw duplicateError(err, from);
  }
}

async function deleteRedirect(id, tenantId) {
  const { deletedCount } = await Redirect.deleteOne({ _id: id, tenant_id: tenantId });
  if (!deletedCount) throw httpError("Redirect not found", 404);
  return { _id: id };
}

async function countRedirects(tenantId) {
  return Redirect.countDocuments({ tenant_id: tenantId });
}

/** The redirect for a requested path, counting the hit; null if none. */
async function resolveRedirect(tenantId, rawPath) {
  const match = await Redirect.findOneAndUpdate(
    { tenant_id: tenantId, from_path: normalizePath(rawPath) },
    { $inc: { hits: 1 }, $set: { last_hit_at: new Date() } },
    { new: true },
  ).lean();
  return match ? { to: match.to_path, status: match.type } : null;
}

module.exports = {
  normalizePath,
  listRedirects,
  createRedirect,
  updateRedirect,
  deleteRedirect,
  countRedirects,
  resolveRedirect,
};
