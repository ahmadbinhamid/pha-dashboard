// services/meta/meta.catalog-api.service.js
// Catalog Batch API and granted-catalog lookup; pure HTTP, no DB.

const { graphGet, graphGetAsApp, graphPost } = require("./meta.graph-api.service");
const { META_ITEM_TYPE, META_CATALOG_SCOPE } = require("../../constants/meta.constants");

/** POST /{catalog}/items_batch; resolves to { handles, validation_status }. */
async function itemsBatch(token, catalogId, requests) {
  const body = await graphPost(token, `${catalogId}/items_batch`, { item_type: META_ITEM_TYPE, requests }, "items_batch");
  return { handles: body.handles || [], validationStatus: body.validation_status || [] };
}

/** GET /{catalog}/check_batch_request_status; the edge returns one node. */
async function checkBatchRequestStatus(token, catalogId, handle) {
  const body = await graphGet(
    token,
    `${catalogId}/check_batch_request_status`,
    { handle, load_ids_of_invalid_requests: "true" },
    "check_batch_request_status",
  );
  return body.data?.[0] ?? null;
}

// NOTE: client_business_id needs only catalog_management; it may be absent.
async function getClientBusinessId(token) {
  const me = await graphGet(token, "me", { fields: "client_business_id" }, "me");
  return me.client_business_id ? String(me.client_business_id) : null;
}

/** Catalog ids from debug_token's catalog_management grant, or null if none. */
async function grantedCatalogIdsFromDebugToken(token) {
  const { data } = await graphGetAsApp("debug_token", { input_token: token }, "debug_token");
  const grant = (data?.granular_scopes || []).find((g) => g.scope === META_CATALOG_SCOPE);
  const ids = (grant?.target_ids || []).map(String);
  return ids.length ? ids : null;
}

/** One catalog's id and name, read with the tenant's token. */
async function getCatalog(token, catalogId) {
  const catalog = await graphGet(token, catalogId, { fields: "id,name" }, "catalog");
  return { id: String(catalog.id), name: catalog.name ?? null };
}

// NOTE: id,name only; a business{} sub-field needs business_management.
async function listAssignedCatalogs(token) {
  const { data = [] } = await graphGet(token, "me/assigned_product_catalogs", { fields: "id,name", limit: "100" }, "assigned_product_catalogs");
  return data.map((c) => ({ id: String(c.id), name: c.name ?? null }));
}

// NOTE: system-user tokens omit granular_scopes; the assigned edge backs it.
async function listGrantedCatalogs(token) {
  const ids = await grantedCatalogIdsFromDebugToken(token);
  if (ids) return Promise.all(ids.map((id) => getCatalog(token, id)));
  return listAssignedCatalogs(token);
}

module.exports = { itemsBatch, checkBatchRequestStatus, getClientBusinessId, listGrantedCatalogs };
