// services/google/google.datasource.service.js
//
// Creates/resolves the tenant's Merchant API primary product data source —
// a prerequisite for any product push (productInputs.insert targeting a
// data source that doesn't exist is rejected). Called during connect (see
// google.controller.js#oauthCallback), not lazily on first sync, per this
// integration's own design decision — a tenant that's "connected" but has
// no data source yet is an inconsistent state worth catching at connect
// time, not surfacing as a confusing failure on the tenant's first publish.

const { logger } = require("../../loaders/logging");

// v1beta was discontinued by Google on 2026-02-28 (confirmed live: a real
// dataSources.create call against v1beta now returns 409 ABORTED
// "V1BETA_RAMP_DOWN" — see https://developers.google.com/merchant/api/guides/compatibility/migrate-v1beta-v1).
const DATASOURCES_BASE = "https://merchantapi.googleapis.com/datasources/v1";
// Separate sub-API from DATASOURCES_BASE — developerRegistration lives
// under accounts/v1, not datasources/v1.
const ACCOUNTS_BASE = "https://merchantapi.googleapis.com/accounts/v1";

function headersFor(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function throwForResponse(res, action) {
  const text = await res.text();
  logger.error(`[google.datasource] ${action} failed`, { status: res.status, body: text });
  const err = new Error(`Google Merchant API ${action} failed: ${res.status} ${text}`);
  err.status = res.status;
  err.body = text;
  throw err;
}

// One-time bootstrap step Google requires before a GCP project's API calls
// are trusted by ANY of its Merchant Center accounts — found live: a fresh
// GCP project's very first dataSources.create call fails 401
// UNAUTHENTICATED / reason "GCP_NOT_REGISTERED" until this runs once (see
// https://developers.google.com/merchant/api/guides/quickstart/registration).
// Idempotent per (GCP project, merchant account) pair — a second call for
// the SAME pair is harmless.
//
// IMPORTANT CONSTRAINT (confirmed against Google's own docs, not assumed):
// a single GCP project can be registered with only ONE Merchant Center
// account at a time — registering a second, different account returns
// ALREADY_REGISTERED. This app's GOOGLE_CLIENT_ID is ONE shared GCP project
// across every tenant (see config/index.js#google's own comment, mirroring
// config.ebay), so as currently built, only ONE tenant's Merchant Center
// account can be connected at a time under this project. ensureDataSource
// below auto-registers on first use (safe — the common case is "not
// registered yet"), but does NOT swallow ALREADY_REGISTERED, since that
// specifically means a DIFFERENT tenant already holds this project's one
// registration slot — a real architectural constraint to surface loudly,
// not paper over.
async function registerGcp(token, merchantId) {
  const url = `${ACCOUNTS_BASE}/accounts/${merchantId}/developerRegistration:registerGcp`;
  const res = await fetch(url, { method: "POST", headers: headersFor(token), body: JSON.stringify({}) });
  if (!res.ok) await throwForResponse(res, "developerRegistration.registerGcp");
  logger.info(`[google.datasource] registered this GCP project as a developer for merchant ${merchantId}`);
  return res.json();
}

function isGcpNotRegistered(err) {
  return err?.status === 401 && typeof err.body === "string" && err.body.includes("GCP_NOT_REGISTERED");
}

function isAlreadyRegistered(err) {
  return typeof err?.body === "string" && err.body.includes("ALREADY_REGISTERED");
}

async function createDataSource(token, { merchantId, feedLabel, contentLanguage, displayName }) {
  const url = `${DATASOURCES_BASE}/accounts/${merchantId}/dataSources`;
  // v1 removed `channel` from PrimaryProductDataSource entirely (confirmed
  // against the real API — v1beta already rejected "ONLINE" as invalid
  // before the ramp-down hard-blocked it) — replaced by an optional
  // `legacyLocal` boolean that exists only to flag "local store, not
  // available online" data sources. This app's data sources are never
  // local-only, so the field is simply omitted (its false default is
  // exactly what an online catalogue needs) rather than asserting it.
  const body = {
    displayName,
    primaryProductDataSource: {
      feedLabel,
      contentLanguage,
    },
  };

  const res = await fetch(url, { method: "POST", headers: headersFor(token), body: JSON.stringify(body) });
  if (res.status === 409) return null; // already exists — caller falls back to listDataSources
  if (res.ok) return res.json();

  const text = await res.text();
  logger.error(`[google.datasource] dataSources.create failed`, { status: res.status, body: text });
  const err = new Error(`Google Merchant API dataSources.create failed: ${res.status} ${text}`);
  err.status = res.status;
  err.body = text;

  // Auto-register, only for the specific "this GCP project has never been
  // registered with this merchant account" case — never for any other 401.
  //
  // Deliberately does NOT retry createDataSource synchronously afterward:
  // Google's own error message says registration can take up to 5 minutes
  // to propagate ("try calling the API again in 5 minutes") — found live,
  // an immediate retry (fired ~300ms after a successful registerGcp call)
  // failed with the exact same GCP_NOT_REGISTERED error. Blocking this HTTP
  // request for minutes to wait it out would be worse than just telling the
  // caller to retry the whole connect flow shortly — see the distinct
  // GCP_REGISTRATION_PENDING code below, which google.controller.js can
  // turn into a specific, friendly redirect reason instead of a generic
  // "exchange_failed".
  if (isGcpNotRegistered(err)) {
    logger.warn(`[google.datasource] GCP project not yet registered with merchant ${merchantId} — registering now`);
    try {
      await registerGcp(token, merchantId);
    } catch (registerErr) {
      if (isAlreadyRegistered(registerErr)) {
        const constraintErr = new Error(
          `This app's Google Cloud project is already registered with a DIFFERENT Merchant Center account. ` +
            `The Merchant API only allows one GCP project to be registered with one Merchant Center account at ` +
            `a time (see https://developers.google.com/merchant/api/guides/quickstart/registration) — connecting ` +
            `merchant ${merchantId} under this same GOOGLE_CLIENT_ID is not possible until that's resolved ` +
            `(e.g. a separate GCP project per tenant, or Google's Multi-Client Account model).`,
        );
        constraintErr.status = 409;
        constraintErr.code = "GCP_REGISTRATION_CONFLICT";
        throw constraintErr;
      }
      throw registerErr;
    }
    const pendingErr = new Error(
      `This Google Cloud project was just registered as a developer for merchant ${merchantId} — Google can take ` +
        `up to 5 minutes to propagate that. Wait a few minutes, then try connecting again.`,
    );
    pendingErr.status = 503;
    pendingErr.code = "GCP_REGISTRATION_PENDING";
    throw pendingErr;
  }

  throw err;
}

async function listDataSources(token, merchantId) {
  const url = `${DATASOURCES_BASE}/accounts/${merchantId}/dataSources`;
  const res = await fetch(url, { headers: headersFor(token) });
  if (!res.ok) await throwForResponse(res, "dataSources.list");
  const data = await res.json();
  return data.dataSources || [];
}

// Idempotent: creates the tenant's data source if it doesn't exist yet,
// otherwise finds and returns the existing one by displayName. Returns the
// data source's short id (the trailing path segment of
// accounts/{id}/dataSources/{dataSourceId}) — this is what gets stored on
// ChannelConnection.data_source_id.
async function ensureDataSource(token, { merchantId, feedLabel, contentLanguage }) {
  const displayName = `Auto Parts Pro — ${feedLabel}`;

  let created = null;
  try {
    created = await createDataSource(token, { merchantId, feedLabel, contentLanguage, displayName });
  } catch (err) {
    // Some Google APIs surface "already exists" as a 400 ALREADY_EXISTS
    // rather than a literal 409 — fall through to the list-and-match path
    // below rather than failing the whole connect flow over a data source
    // that's actually already there.
    if (err.status !== 400) throw err;
    logger.warn(`[google.datasource] create returned 400 (possibly ALREADY_EXISTS) — falling back to lookup: ${err.message}`);
  }

  if (created?.name) {
    return created.name.split("/").pop();
  }

  const existing = await listDataSources(token, merchantId);
  const match = existing.find((ds) => ds.displayName === displayName);
  if (!match) {
    const err = new Error(`Could not create or find a Merchant API data source for merchant ${merchantId} (${displayName})`);
    err.status = 502;
    throw err;
  }
  return match.name.split("/").pop();
}

module.exports = { createDataSource, listDataSources, ensureDataSource, registerGcp };
