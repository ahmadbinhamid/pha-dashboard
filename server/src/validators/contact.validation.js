// validators/contact.validation.js

const Joi = require("joi");
const { CONTACT_STATUS, CONTACT_SOURCE, LIST_NAME_MAX, MAX_LISTS_PER_CONTACT } = require("../constants/campaign.constants");

const objectId = Joi.string().hex().length(24);
const listName = Joi.string().trim().min(1).max(LIST_NAME_MAX);
const personName = Joi.string().trim().allow("", null).max(80);

const byIdParam = { params: Joi.object({ id: objectId.required() }) };

const filters = {
  search: Joi.string().trim().allow("").max(100),
  status: Joi.string().valid(...Object.values(CONTACT_STATUS)),
  list: listName,
  source: Joi.string().valid(...Object.values(CONTACT_SOURCE)),
};

const listContacts = {
  query: Joi.object({ ...filters, page: Joi.number().integer().min(1), limit: Joi.number().integer().min(1).max(100) }),
};

const exportContacts = { query: Joi.object(filters) };

const selectContactIds = { query: Joi.object(filters) };

const renameList = { body: Joi.object({ from: listName.required(), to: listName.required() }) };
const deleteList = { body: Joi.object({ name: listName.required() }) };

const createContact = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().required(),
    first_name: personName,
    last_name: personName,
    lists: Joi.array().items(listName).max(MAX_LISTS_PER_CONTACT),
  }),
};

// Status may only move to unsubscribed; consent comes from the person.
const updateContact = {
  ...byIdParam,
  body: Joi.object({
    first_name: personName,
    last_name: personName,
    lists: Joi.array().items(listName).max(MAX_LISTS_PER_CONTACT),
    status: Joi.string().valid(CONTACT_STATUS.UNSUBSCRIBED),
  }).min(1),
};

const bulkLists = {
  body: Joi.object({
    ids: Joi.array().items(objectId).min(1).max(500).required(),
    add: listName,
    remove: listName,
  }).or("add", "remove"),
};

// Multipart: `lists` arrives as one comma-separated string field.
const importContacts = { body: Joi.object({ lists: Joi.string().trim().allow("").max(500) }) };

module.exports = {
  byIdParam,
  listContacts,
  exportContacts,
  selectContactIds,
  renameList,
  deleteList,
  createContact,
  updateContact,
  bulkLists,
  importContacts,
};
