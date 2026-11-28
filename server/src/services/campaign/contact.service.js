// services/campaign/contact.service.js
// Campaign contacts: CRUD, signups, imports, audiences and unsubscribes.

const mongoose = require("mongoose");
const Contact = require("../../models/Contact");
const { cursorMarketingOptInCustomers, revokeMarketingOptIn } = require("../customer.service");
const { httpError } = require("../../utils/http/httpError");
const { buildAllWordsSearchAnd } = require("../../utils/regex");
const {
  CONTACT_STATUS,
  CONTACT_SOURCE,
  AUDIENCE_TYPE,
  IMPORT_CHUNK_SIZE,
  LIST_NAME_MAX,
  MAX_LISTS_PER_CONTACT,
  MAX_SELECTED_CONTACTS,
} = require("../../constants/campaign.constants");

const LIST_FIELDS =
  "email first_name last_name status source lists subscribed_at unsubscribed_at bounced_at bounce_reason last_emailed_at created_at";
const BOUNCE_REASON_MAX = 300;

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

/** "Jane van Dyke" -> first "Jane", last "van Dyke". */
function splitName(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first_name: null, last_name: null };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") || null };
}

/** Trimmed, de-duplicated (case-insensitively) and capped list names. */
function normalizeLists(lists = []) {
  const seen = new Map();
  for (const raw of lists) {
    const name = String(raw || "").trim().slice(0, LIST_NAME_MAX);
    if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
  }
  return [...seen.values()].slice(0, MAX_LISTS_PER_CONTACT);
}

function buildListFilter(tenantId, { search, status, list, source } = {}) {
  const filter = { tenant_id: tenantId };
  if (status) filter.status = status;
  if (list) filter.lists = list;
  if (source) filter.source = source;
  const words = buildAllWordsSearchAnd(["email", "first_name", "last_name"], search);
  if (words.length) filter.$and = words;
  return filter;
}

async function findContact(id, tenantId) {
  const contact = await Contact.findOne({ _id: id, tenant_id: tenantId }).select(LIST_FIELDS).lean();
  if (!contact) throw httpError("Contact not found", 404);
  return contact;
}

async function listContacts(tenantId, { skip = 0, limit = 20, ...filters } = {}) {
  const filter = buildListFilter(tenantId, filters);
  const [items, total] = await Promise.all([
    Contact.find(filter).select(LIST_FIELDS).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
    Contact.countDocuments(filter),
  ]);
  return { items, total };
}

async function getContactStats(tenantId) {
  const rows = await Contact.aggregate([
    { $match: { tenant_id: toObjectId(tenantId) } },
    { $group: { _id: { status: "$status", source: "$source" }, count: { $sum: 1 } } },
  ]);
  const stats = { total: 0, by_status: {}, by_source: {} };
  for (const { _id, count } of rows) {
    stats.total += count;
    stats.by_status[_id.status] = (stats.by_status[_id.status] ?? 0) + count;
    stats.by_source[_id.source] = (stats.by_source[_id.source] ?? 0) + count;
  }
  return stats;
}

/** Every list name in use, with how many subscribed contacts are on it. */
async function listContactLists(tenantId) {
  const rows = await Contact.aggregate([
    { $match: { tenant_id: toObjectId(tenantId) } },
    { $unwind: "$lists" },
    {
      $group: {
        _id: "$lists",
        total: { $sum: 1 },
        subscribed: { $sum: { $cond: [{ $eq: ["$status", CONTACT_STATUS.SUBSCRIBED] }, 1, 0] } },
      },
    },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ name: r._id, total: r.total, subscribed: r.subscribed }));
}

/** Ids matching a filter, for "select all"; capped at the picker's limit. */
async function selectContactIds(tenantId, filters) {
  const filter = buildListFilter(tenantId, { ...filters, status: CONTACT_STATUS.SUBSCRIBED });
  const [rows, total] = await Promise.all([
    Contact.find(filter).select("_id").sort({ created_at: -1 }).limit(MAX_SELECTED_CONTACTS).lean(),
    Contact.countDocuments(filter),
  ]);
  return { ids: rows.map((r) => r._id), total, capped: total > MAX_SELECTED_CONTACTS };
}

/** Email and name for picked contacts, in the order they were given. */
async function findContactsByIds(tenantId, ids) {
  const rows = await Contact.find({ tenant_id: tenantId, _id: { $in: ids } }).select(LIST_FIELDS).lean();
  const byId = new Map(rows.map((r) => [String(r._id), r]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
}

/** Renames a list on every contact; merges into an existing list name. */
async function renameList(tenantId, from, to) {
  const target = normalizeLists([to])[0];
  if (!target) throw httpError("Give the list a name", 422);
  const filter = { tenant_id: tenantId, lists: from };
  await Contact.updateMany(filter, { $addToSet: { lists: target } });
  if (target !== from) await Contact.updateMany({ tenant_id: tenantId, lists: target }, { $pull: { lists: from } });
  return { name: target };
}

/** Removes the list tag only; the contacts themselves stay. */
async function deleteList(tenantId, name) {
  const { modifiedCount } = await Contact.updateMany({ tenant_id: tenantId, lists: name }, { $pull: { lists: name } });
  return { name, removed_from: modifiedCount };
}

async function createContact(tenantId, { email, first_name, last_name, lists }) {
  if (await Contact.exists({ tenant_id: tenantId, email })) throw httpError(`${email} is already a contact`, 409);
  const contact = await Contact.create({
    tenant_id: tenantId,
    email,
    first_name: first_name || null,
    last_name: last_name || null,
    lists: normalizeLists(lists),
    source: CONTACT_SOURCE.MANUAL,
  });
  return findContact(contact._id, tenantId);
}

// NOTE: staff can't resubscribe anyone; only the person's own signup can.
async function updateContact(id, tenantId, patch) {
  const current = await findContact(id, tenantId);
  const $set = {};
  if (patch.first_name !== undefined) $set.first_name = patch.first_name || null;
  if (patch.last_name !== undefined) $set.last_name = patch.last_name || null;
  if (patch.lists !== undefined) $set.lists = normalizeLists(patch.lists);
  await Contact.updateOne({ _id: current._id, tenant_id: tenantId }, { $set });
  if (patch.status === CONTACT_STATUS.UNSUBSCRIBED && current.status === CONTACT_STATUS.SUBSCRIBED) {
    await unsubscribeContact(tenantId, current);
  }
  return findContact(id, tenantId);
}

async function deleteContact(id, tenantId) {
  const { deletedCount } = await Contact.deleteOne({ _id: id, tenant_id: tenantId });
  if (!deletedCount) throw httpError("Contact not found", 404);
  return { _id: id };
}

/** Adds or removes one list name across many contacts at once. */
async function bulkUpdateLists(tenantId, { ids, add, remove }) {
  const filter = { tenant_id: tenantId, _id: { $in: ids } };
  const ops = [];
  if (add) ops.push({ updateMany: { filter, update: { $addToSet: { lists: normalizeLists([add])[0] } } } });
  if (remove) ops.push({ updateMany: { filter, update: { $pull: { lists: remove } } } });
  if (ops.length) await Contact.bulkWrite(ops, { ordered: true });
  return { updated: ids.length };
}

/** A storefront signup is the person's own consent, so it resubscribes. */
async function subscribeFromNewsletter(tenantId, { email, first_name, lists = [] }) {
  const now = new Date();
  const listNames = normalizeLists(lists);
  const contact = await Contact.findOneAndUpdate(
    { tenant_id: tenantId, email },
    {
      $set: { status: CONTACT_STATUS.SUBSCRIBED, unsubscribed_at: null, bounced_at: null, bounce_reason: null },
      ...(listNames.length && { $addToSet: { lists: { $each: listNames } } }),
      $setOnInsert: {
        source: CONTACT_SOURCE.NEWSLETTER,
        first_name: first_name || null,
        subscribed_at: now,
        unsubscribe_token: Contact.newUnsubscribeToken(),
      },
    },
    { upsert: true, new: true, includeResultMetadata: true },
  ).lean();
  return { contact: contact.value, created: !contact.lastErrorObject?.updatedExisting };
}

/** One upsert per row; never touches the status of an existing contact. */
function importUpsertOp(tenantId, row, lists, source, extraOnInsert = {}) {
  const $set = {};
  if (row.first_name) $set.first_name = row.first_name;
  if (row.last_name) $set.last_name = row.last_name;
  const rowLists = normalizeLists([...lists, ...(row.lists ?? [])]);
  return {
    updateOne: {
      filter: { tenant_id: tenantId, email: row.email },
      update: {
        ...(Object.keys($set).length && { $set }),
        ...(rowLists.length && { $addToSet: { lists: { $each: rowLists } } }),
        $setOnInsert: {
          source,
          status: CONTACT_STATUS.SUBSCRIBED,
          subscribed_at: new Date(),
          unsubscribe_token: Contact.newUnsubscribeToken(),
          ...extraOnInsert,
        },
      },
      upsert: true,
    },
  };
}

async function importChunk(tenantId, rows, lists) {
  const emails = rows.map((r) => r.email);
  const existing = await Contact.find({ tenant_id: tenantId, email: { $in: emails } }).select("email status").lean();
  const unsubscribed = existing.filter((c) => c.status !== CONTACT_STATUS.SUBSCRIBED).length;
  await Contact.bulkWrite(
    rows.map((row) => importUpsertOp(tenantId, row, lists, CONTACT_SOURCE.IMPORT)),
    { ordered: false },
  );
  return { created: rows.length - existing.length, updated: existing.length, unsubscribed };
}

/** Upserts parsed sheet rows in chunks; unsubscribed people stay suppressed. */
async function importContacts(tenantId, rows, { lists = [] } = {}) {
  const totals = { created: 0, updated: 0, unsubscribed: 0 };
  const normalized = normalizeLists(lists);
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
    const result = await importChunk(tenantId, rows.slice(i, i + IMPORT_CHUNK_SIZE), normalized);
    totals.created += result.created;
    totals.updated += result.updated;
    totals.unsubscribed += result.unsubscribed;
  }
  return totals;
}

async function flushCustomerOps(ops) {
  if (ops.length) await Contact.bulkWrite(ops.splice(0), { ordered: false });
}

/** Brings opted-in customers in as contacts; only ever inserts. */
async function syncOptedInCustomers(tenantId) {
  const ops = [];
  for await (const customer of cursorMarketingOptInCustomers(tenantId)) {
    const row = { email: String(customer.email).trim().toLowerCase(), ...splitName(customer.name) };
    ops.push(importUpsertOp(tenantId, row, [], CONTACT_SOURCE.CUSTOMER, { customer_id: customer._id }));
    if (ops.length >= IMPORT_CHUNK_SIZE) await flushCustomerOps(ops);
  }
  await flushCustomerOps(ops);
}

function audienceFilter(tenantId, audience) {
  const filter = { tenant_id: tenantId, status: CONTACT_STATUS.SUBSCRIBED };
  if (audience?.type === AUDIENCE_TYPE.LISTS) filter.lists = { $in: audience.lists ?? [] };
  if (audience?.type === AUDIENCE_TYPE.CONTACTS) filter._id = { $in: audience.contact_ids ?? [] };
  return filter;
}

async function countAudience(tenantId, audience) {
  return Contact.countDocuments(audienceFilter(tenantId, audience));
}

/** Subscribed recipient ids in _id order, for chunked fan-out. */
function cursorAudienceIds(tenantId, audience) {
  return Contact.find(audienceFilter(tenantId, audience)).select("_id").sort({ _id: 1 }).lean().cursor();
}

function cursorContactsForExport(tenantId, filters) {
  return Contact.find(buildListFilter(tenantId, filters)).select(LIST_FIELDS).sort({ _id: 1 }).lean().cursor();
}

async function findContactForDelivery(contactId) {
  return Contact.findById(contactId).select("tenant_id email first_name last_name status unsubscribe_token").lean();
}

async function markContactEmailed(contactId) {
  await Contact.updateOne({ _id: contactId }, { $set: { last_emailed_at: new Date() } });
}

/** A dead mailbox stops getting campaigns; a fresh signup clears it. */
async function markContactBounced(contactId, reason) {
  await Contact.updateOne(
    { _id: contactId, status: CONTACT_STATUS.SUBSCRIBED },
    { $set: { status: CONTACT_STATUS.BOUNCED, bounced_at: new Date(), bounce_reason: String(reason || "").slice(0, BOUNCE_REASON_MAX) || null } },
  );
}

async function findContactByUnsubscribeToken(token) {
  return Contact.findOne({ unsubscribe_token: token }).select("tenant_id email status").lean();
}

async function unsubscribeContact(tenantId, contact) {
  await Contact.updateOne(
    { _id: contact._id, tenant_id: tenantId },
    { $set: { status: CONTACT_STATUS.UNSUBSCRIBED, unsubscribed_at: new Date() } },
  );
  await revokeMarketingOptIn(tenantId, contact.email);
}

/** Public unsubscribe; idempotent, null when the token matches nobody. */
async function unsubscribeByToken(token) {
  const contact = await findContactByUnsubscribeToken(token);
  if (!contact) return null;
  if (contact.status === CONTACT_STATUS.SUBSCRIBED) await unsubscribeContact(contact.tenant_id, contact);
  return { tenantId: contact.tenant_id, email: contact.email };
}

module.exports = {
  splitName,
  normalizeLists,
  listContacts,
  getContactStats,
  listContactLists,
  selectContactIds,
  findContactsByIds,
  renameList,
  deleteList,
  createContact,
  updateContact,
  deleteContact,
  bulkUpdateLists,
  subscribeFromNewsletter,
  importContacts,
  syncOptedInCustomers,
  countAudience,
  cursorAudienceIds,
  cursorContactsForExport,
  findContactForDelivery,
  markContactEmailed,
  markContactBounced,
  findContactByUnsubscribeToken,
  unsubscribeByToken,
};
