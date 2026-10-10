// services/meta/meta.catalog-api.service.js
// Catalog Batch API and business/catalog listing; pure HTTP, no DB.

const { logger } = require("../../loaders/logging");
const { graphGet, graphPost } = require("./meta.graph-api.service");
const { META_ITEM_TYPE } = require("../../constants/meta.constants");

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

// NOTE: a business-integration token names one client business via /me.
async function listBusinesses(token) {
  const me = await graphGet(token, "me", { fields: "client_business_id" }, "me");
  if (me.client_business_id) {
    const business = await graphGet(token, me.client_business_id, { fields: "id,name" }, "business");
    return [{ id: String(business.id), name: business.name ?? null }];
  }
  const { data = [] } = await graphGet(token, "me/businesses", { fields: "id,name", limit: "100" }, "me/businesses");
  return data.map((b) => ({ id: String(b.id), name: b.name ?? null }));
}

// Shared catalogs are optional; a failure there is logged, never hidden.
function sharedCatalogsOrEmpty(err) {
  logger.warn("[meta.catalog] client_product_catalogs unavailable; listing owned catalogs only", { metaCode: err.metaCode, status: err.status });
  return { data: [] };
}

// Owned and client-shared catalogs, de-duplicated by id.
async function listCatalogs(token, businessId) {
  const params = { fields: "id,name", limit: "100" };
  const [owned, shared] = await Promise.all([
    graphGet(token, `${businessId}/owned_product_catalogs`, params, "owned_product_catalogs"),
    graphGet(token, `${businessId}/client_product_catalogs`, params, "client_product_catalogs").catch(sharedCatalogsOrEmpty),
  ]);
  const byId = new Map();
  for (const c of [...(owned.data || []), ...(shared.data || [])]) byId.set(String(c.id), { id: String(c.id), name: c.name ?? null });
  return [...byId.values()];
}

module.exports = { itemsBatch, checkBatchRequestStatus, listBusinesses, listCatalogs };
