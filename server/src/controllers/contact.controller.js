// controllers/contact.controller.js

const contactService = require("../services/campaign/contact.service");
const { parseContactSheet, writeContactsWorkbook } = require("../services/campaign/contact-sheet.service");
const { success, created, systemfailure } = require("../utils/http/response");
const { toPage } = require("../utils/http/handle");
const { logger } = require("../loaders/logging");

const filtersFrom = (query) => ({ search: query.search, status: query.status, list: query.list, source: query.source });

exports.listContacts = async (req, res) => {
  try {
    const { limit, skip } = req.pagination;
    const result = await contactService.listContacts(req.tenantId, { skip, limit, ...filtersFrom(req.query) });
    return success(res, toPage(req.pagination, result));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.getContactStats = async (req, res) => {
  try {
    return success(res, await contactService.getContactStats(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.listContactLists = async (req, res) => {
  try {
    return success(res, await contactService.listContactLists(req.tenantId));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.selectContactIds = async (req, res) => {
  try {
    return success(res, await contactService.selectContactIds(req.tenantId, filtersFrom(req.query)));
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.renameList = async (req, res) => {
  try {
    return success(res, await contactService.renameList(req.tenantId, req.body.from, req.body.to), "List renamed");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteList = async (req, res) => {
  try {
    return success(res, await contactService.deleteList(req.tenantId, req.body.name), "List removed");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.createContact = async (req, res) => {
  try {
    return created(res, await contactService.createContact(req.tenantId, req.body), "Contact added");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.updateContact = async (req, res) => {
  try {
    return success(res, await contactService.updateContact(req.params.id, req.tenantId, req.body), "Contact saved");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.deleteContact = async (req, res) => {
  try {
    return success(res, await contactService.deleteContact(req.params.id, req.tenantId), "Contact deleted");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.bulkUpdateLists = async (req, res) => {
  try {
    return success(res, await contactService.bulkUpdateLists(req.tenantId, req.body), "Lists updated");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.importContacts = async (req, res) => {
  try {
    const { rows, invalid, duplicates } = await parseContactSheet(req.file);
    const lists = String(req.body.lists || "").split(",");
    const result = await contactService.importContacts(req.tenantId, rows, { lists });
    return success(res, { ...result, invalid, duplicates, total: rows.length }, "Contacts imported");
  } catch (err) {
    return systemfailure(res, err);
  }
};

exports.exportContacts = async (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="contacts-${stamp}.xlsx"`);
  try {
    await writeContactsWorkbook(contactService.cursorContactsForExport(req.tenantId, filtersFrom(req.query)), res);
  } catch (err) {
    // Bytes may already be on the wire, so a JSON error is no longer possible.
    logger.error("[contacts] export failed", { error: err.message, tenantId: String(req.tenantId) });
    if (!res.headersSent) return systemfailure(res, err);
    res.destroy(err);
  }
};
