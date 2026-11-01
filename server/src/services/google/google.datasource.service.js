// services/google/google.datasource.service.js
// Creates or finds a tenant's Merchant data source at connect, before pushes.

const { logger } = require("../../loaders/logging");

// v1beta was shut down 2026-02-28; it now returns 409 V1BETA_RAMP_DOWN.
const DATASOURCES_BASE = "https://merchantapi.googleapis.com/datasources/v1";
// developerRegistration lives under accounts/v1, not datasources/v1.
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

// Needed once per GCP project, one merchant per project: never swallow 409.
async function registerGcp(token, merchantId, developerEmail = null) {
  const url = `${ACCOUNTS_BASE}/accounts/${merchantId}/developerRegistration:registerGcp`;
  const body = developerEmail ? { developerEmail } : {};
  const res = await fetch(url, { method: "POST", headers: headersFor(token), body: JSON.stringify(body) });
  if (!res.ok) await throwForResponse(res, "developerRegistration.registerGcp");
  logger.info(`[google.datasource] registered this GCP project as a developer for merchant ${merchantId}`);
  return res.json();
}

// Which merchant this GCP project is registered to; none is a valid state.
async function getAccountForGcpRegistration(token) {
  const url = `${ACCOUNTS_BASE}/accounts:getAccountForGcpRegistration`;
  const res = await fetch(url, { headers: headersFor(token) });
  if (!res.ok) await throwForResponse(res, "developerRegistration.getAccountForGcpRegistration");
  return res.json();
}

// Merchant accounts this Google user may pick; one 250-row page is enough.
async function listAccounts(token) {
  const url = `${ACCOUNTS_BASE}/accounts?pageSize=250`;
  const res = await fetch(url, { headers: headersFor(token) });
  if (!res.ok) await throwForResponse(res, "accounts.list");
  const data = await res.json();
  return (data.accounts || []).map((a) => ({ accountId: a.accountId, accountName: a.accountName || null }));
}

function isGcpNotRegistered(err) {
  return err?.status === 401 && typeof err.body === "string" && err.body.includes("GCP_NOT_REGISTERED");
}

function isAlreadyRegistered(err) {
  return typeof err?.body === "string" && err.body.includes("ALREADY_REGISTERED");
}

async function createDataSource(token, { merchantId, feedLabel, contentLanguage, displayName }) {
  const url = `${DATASOURCES_BASE}/accounts/${merchantId}/dataSources`;
  // v1 dropped `channel`; legacyLocal's false default suits online feeds.
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

  // Register on GCP_NOT_REGISTERED only; it takes ~5 min, so no retry here.
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

// Feeds made before the rename keep their old name, so lookups accept both.
const DATA_SOURCE_PREFIXES = Object.freeze(["Parts Manager", "Auto Parts Pro"]);

/** Creates or finds the tenant's data source; returns its short id. */
async function ensureDataSource(token, { merchantId, feedLabel, contentLanguage }) {
  const displayName = `${DATA_SOURCE_PREFIXES[0]} — ${feedLabel}`;
  const knownNames = DATA_SOURCE_PREFIXES.map((prefix) => `${prefix} — ${feedLabel}`);

  let created = null;
  try {
    created = await createDataSource(token, { merchantId, feedLabel, contentLanguage, displayName });
  } catch (err) {
    // Google reports "already exists" as a 400, so fall back to a lookup.
    if (err.status !== 400) throw err;
    logger.warn(`[google.datasource] create returned 400 (possibly ALREADY_EXISTS) — falling back to lookup: ${err.message}`);
  }

  if (created?.name) {
    return created.name.split("/").pop();
  }

  const existing = await listDataSources(token, merchantId);
  const match = existing.find((ds) => knownNames.includes(ds.displayName));
  if (!match) {
    const err = new Error(`Could not create or find a Merchant API data source for merchant ${merchantId} (${displayName})`);
    err.status = 502;
    throw err;
  }
  return match.name.split("/").pop();
}

module.exports = { createDataSource, listDataSources, ensureDataSource, registerGcp, getAccountForGcpRegistration, listAccounts };
