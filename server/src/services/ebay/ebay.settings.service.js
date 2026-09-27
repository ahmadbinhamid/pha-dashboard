// services/ebay/ebay.settings.service.js
// Public contract is unchanged from pre-ChannelConnection; this is the only file that knows
// storage moved to ChannelConnection (see models/ChannelConnection.js, docs/channel-architecture.md).
// Lazy read-through migration: reads check ChannelConnection then fall back to EbaySettings and
// upsert; writes go to ChannelConnection only, after ensureMigrated. EbaySettings stays as legacy source.

const crypto = require("crypto");
const mongoose = require("mongoose");
const ChannelConnection = require("../../models/ChannelConnection");
const EbaySettings = require("../../models/EbaySettings");
const { logger } = require("../../loaders/logging");
const { encrypt, decrypt } = require("../../utils/crypto/tokenCipher");
const { EBAY_CONNECTION_STATUS } = require("../../constants/ebay.constants");
const { CHANNEL_CONNECTION_STATUS } = require("../../constants/channel.constants");
const { MARKETPLACE_PLATFORM } = require("../../constants/marketplace.constants");

const PLATFORM = MARKETPLACE_PLATFORM.EBAY;
const SECRET_FIELDS = "+refresh_token_ciphertext +refresh_token_iv +refresh_token_tag";
const CONN_SECRET_FIELDS = "+refresh_token_ct";

// ── ciphertext packing ───────────────────────────────────────────────────────
// Packs {ciphertext, iv, tag} into one delimited string for ChannelConnection's generic
// refresh_token_ct field. Base64 never contains ".", so joining/splitting on it is safe.
function packCiphertext({ ciphertext, iv, tag }) {
  if (!ciphertext) return null;
  return `${iv}.${tag}.${ciphertext}`;
}

function unpackCiphertext(packed) {
  if (!packed) return { ciphertext: null, iv: null, tag: null };
  const [iv, tag, ciphertext] = packed.split(".");
  return { ciphertext, iv, tag };
}

// ── status <-> legacy connection_status ──────────────────────────────────────
// 'degraded' has no legacy equivalent, mapped to ERROR to avoid a new enum value the frontend
// doesn't know. token_expired/revoked are never actually written, so only CONNECTED/NOT_CONNECTED/ERROR matter.
function statusToLegacy(status) {
  switch (status) {
    case CHANNEL_CONNECTION_STATUS.CONNECTED:
      return EBAY_CONNECTION_STATUS.CONNECTED;
    case CHANNEL_CONNECTION_STATUS.DEGRADED:
    case CHANNEL_CONNECTION_STATUS.ERROR:
      return EBAY_CONNECTION_STATUS.ERROR;
    case CHANNEL_CONNECTION_STATUS.DISCONNECTED:
    default:
      return EBAY_CONNECTION_STATUS.NOT_CONNECTED;
  }
}

function legacyToStatus(connectionStatus) {
  switch (connectionStatus) {
    case EBAY_CONNECTION_STATUS.CONNECTED:
      return CHANNEL_CONNECTION_STATUS.CONNECTED;
    case EBAY_CONNECTION_STATUS.ERROR:
    case EBAY_CONNECTION_STATUS.TOKEN_EXPIRED:
    case EBAY_CONNECTION_STATUS.REVOKED:
      return CHANNEL_CONNECTION_STATUS.ERROR;
    default:
      return CHANNEL_CONNECTION_STATUS.DISCONNECTED;
  }
}

// Translates a ChannelConnection doc into the plain shape every existing consumer expects.
function toLegacyShape(conn) {
  if (!conn) return {};
  const refresh_token = decrypt(unpackCiphertext(conn.refresh_token_ct));

  return {
    _id: conn._id,
    tenant_id: conn.tenant_id,
    connection_status: statusToLegacy(conn.status),
    connected_at: conn.connected_at ?? null,
    last_error: conn.last_error ?? null,

    marketplace_id: conn.marketplace_id ?? "EBAY_AU",
    sandbox: conn.sandbox ?? false,

    merchant_location_key: conn.merchant_location_key ?? null,
    fulfillment_policy_id: conn.fulfillment_policy_id ?? null,
    payment_policy_id: conn.payment_policy_id ?? null,
    return_policy_id: conn.return_policy_id ?? null,

    warehouse_street: conn.warehouse_street ?? null,
    warehouse_city: conn.warehouse_city ?? null,
    warehouse_state: conn.warehouse_state ?? null,
    warehouse_postcode: conn.warehouse_postcode ?? null,
    warehouse_country: conn.warehouse_country ?? "AU",
    warehouse_phone: conn.warehouse_phone ?? null,

    fallback_image_url: conn.fallback_image_url ?? null,

    webhook_token: conn.webhook_token ?? null,
    verification_token: conn.verification_token ?? null,

    created_at: conn.created_at,
    updated_at: conn.updated_at,

    refresh_token,
  };
}

// Builds the ChannelConnection field set from a legacy EbaySettings doc; shared by the lazy
// per-tenant migration below and the bulk migration script.
function fieldsFromLegacy(legacy) {
  const hasToken = !!legacy.refresh_token_ciphertext;
  // A legacy row with no token must migrate as 'disconnected' — trust actual token presence, not the stale status field.
  const status = hasToken
    ? (legacy.connection_status === EBAY_CONNECTION_STATUS.ERROR
        ? CHANNEL_CONNECTION_STATUS.ERROR
        : CHANNEL_CONNECTION_STATUS.CONNECTED)
    : CHANNEL_CONNECTION_STATUS.DISCONNECTED;

  return {
    tenant_id: legacy.tenant_id,
    platform: PLATFORM,
    status,
    // Copied verbatim from legacy ciphertext/iv/tag, never decrypted/re-encrypted.
    refresh_token_ct: packCiphertext({
      ciphertext: legacy.refresh_token_ciphertext,
      iv: legacy.refresh_token_iv,
      tag: legacy.refresh_token_tag,
    }),
    connected_at: legacy.connected_at ?? null,
    last_error: legacy.last_error ?? null,
    webhook_token: legacy.webhook_token ?? null,
    marketplace_id: legacy.marketplace_id ?? "EBAY_AU",
    sandbox: legacy.sandbox ?? false,
    merchant_location_key: legacy.merchant_location_key ?? null,
    fulfillment_policy_id: legacy.fulfillment_policy_id ?? null,
    payment_policy_id: legacy.payment_policy_id ?? null,
    return_policy_id: legacy.return_policy_id ?? null,
    warehouse_street: legacy.warehouse_street ?? null,
    warehouse_city: legacy.warehouse_city ?? null,
    warehouse_state: legacy.warehouse_state ?? null,
    warehouse_postcode: legacy.warehouse_postcode ?? null,
    warehouse_country: legacy.warehouse_country ?? "AU",
    warehouse_phone: legacy.warehouse_phone ?? null,
    fallback_image_url: legacy.fallback_image_url ?? null,
    verification_token: legacy.verification_token ?? null,
  };
}

// Idempotent, race-safe via the {tenant_id, platform} unique index and $setOnInsert.
async function migrateFromLegacy(tenantId) {
  const legacy = await EbaySettings.findOne({ tenant_id: tenantId }).select(SECRET_FIELDS).lean();
  if (!legacy) return null;

  const fields = fieldsFromLegacy(legacy);
  try {
    return await ChannelConnection.findOneAndUpdate(
      { tenant_id: tenantId, platform: PLATFORM },
      { $setOnInsert: fields },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .select(CONN_SECRET_FIELDS)
      .lean();
  } catch (err) {
    if (err.code === 11000) {
      // Lost the race to another upsert — re-read instead of erroring.
      return ChannelConnection.findOne({ tenant_id: tenantId, platform: PLATFORM }).select(CONN_SECRET_FIELDS).lean();
    }
    throw err;
  }
}

// Ensures a ChannelConnection row exists before a write, so a partial update on an already-connected
// legacy tenant doesn't create a bare row missing their refresh_token/policies. Never throws.
async function ensureMigrated(tenantId) {
  const existing = await ChannelConnection.findOne({ tenant_id: tenantId, platform: PLATFORM }).select("_id").lean();
  if (existing) return;
  await migrateFromLegacy(tenantId);
}

// ── legacy fallback (EbaySettings-only reads) ────────────────────────────────
// Used only when ChannelConnection itself errors (see getSettings' catch); deliberately
// duplicates the pre-migration logic so a ChannelConnection outage can't break the fallback.
function withDecryptedRefreshTokenLegacy(doc) {
  if (!doc) return doc;
  const refresh_token = decrypt({
    ciphertext: doc.refresh_token_ciphertext,
    iv: doc.refresh_token_iv,
    tag: doc.refresh_token_tag,
  });
  const { refresh_token_ciphertext, refresh_token_iv, refresh_token_tag, ...rest } = doc;
  return { ...rest, refresh_token };
}

async function legacyGetSettings(tenantId) {
  const doc = await EbaySettings.findOne({ tenant_id: tenantId }).select(SECRET_FIELDS).lean();
  return withDecryptedRefreshTokenLegacy(doc) || {};
}

// ── public API (unchanged shape) ─────────────────────────────────────────────

async function getSettings(tenantId) {
  try {
    let conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: PLATFORM })
      .select(CONN_SECRET_FIELDS)
      .lean();
    if (!conn) conn = await migrateFromLegacy(tenantId);
    return toLegacyShape(conn);
  } catch (err) {
    // Never throw into the caller's request path — fall back to legacy EbaySettings directly.
    logger.warn("[ebay.settings] ChannelConnection read failed — falling back to legacy EbaySettings", {
      tenantId: String(tenantId),
      error: err.message,
    });
    return legacyGetSettings(tenantId);
  }
}

async function upsertSettings(tenantId, update) {
  await ensureMigrated(tenantId).catch((err) =>
    logger.warn("[ebay.settings] ensureMigrated failed before write — proceeding anyway", {
      tenantId: String(tenantId),
      error: err.message,
    }),
  );

  const { refresh_token, ...rest } = update;
  const setFields = { ...rest };

  if (refresh_token !== undefined) {
    const { ciphertext, iv, tag } = encrypt(refresh_token);
    setFields.refresh_token_ct = packCiphertext({ ciphertext, iv, tag });
    setFields.status = refresh_token ? CHANNEL_CONNECTION_STATUS.CONNECTED : CHANNEL_CONNECTION_STATUS.DISCONNECTED;
    setFields.connected_at = refresh_token ? new Date() : null;
    if (refresh_token) setFields.last_error = null;
  }

  const conn = await ChannelConnection.findOneAndUpdate(
    { tenant_id: tenantId, platform: PLATFORM },
    { $set: setFields, $setOnInsert: { tenant_id: tenantId, platform: PLATFORM } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
    .select(CONN_SECRET_FIELDS)
    .lean();

  logger.info("[ebay.settings] Settings updated", { tenantId: String(tenantId), fields: Object.keys(setFields) });
  return toLegacyShape(conn);
}

// Records a connection failure (e.g. revoked token) so Settings shows it instead of failing silently.
// `status` stays an EBAY_CONNECTION_STATUS value, translated internally to the generic status.
async function markConnectionError(tenantId, { status = EBAY_CONNECTION_STATUS.ERROR, message } = {}) {
  await ensureMigrated(tenantId).catch(() => {});
  await ChannelConnection.updateOne(
    { tenant_id: tenantId, platform: PLATFORM },
    { $set: { status: legacyToStatus(status), last_error: message ?? null }, $setOnInsert: { tenant_id: tenantId, platform: PLATFORM } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  logger.warn("[ebay.settings] Connection marked as errored", { tenantId: String(tenantId), status, message });
}

async function ensureVerificationToken(tenantId) {
  await ensureMigrated(tenantId).catch(() => {});
  let conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: PLATFORM });
  if (!conn) conn = new ChannelConnection({ tenant_id: tenantId, platform: PLATFORM });

  if (!conn.verification_token) {
    conn.verification_token = crypto.randomBytes(32).toString("hex");
    await conn.save();
    logger.info("[ebay.settings] Verification token generated and saved", { tenantId: String(tenantId) });
  }

  return conn.verification_token;
}

// Opaque identifier used in the shared webhook URL in place of the tenant's real _id.
async function ensureWebhookToken(tenantId) {
  await ensureMigrated(tenantId).catch(() => {});
  let conn = await ChannelConnection.findOne({ tenant_id: tenantId, platform: PLATFORM });
  if (!conn) conn = new ChannelConnection({ tenant_id: tenantId, platform: PLATFORM });

  if (!conn.webhook_token) {
    conn.webhook_token = crypto.randomBytes(24).toString("hex");
    await conn.save();
    logger.info("[ebay.settings] Webhook token generated and saved", { tenantId: String(tenantId) });
  }

  return conn.webhook_token;
}

// Resolves the tenant a webhook belongs to purely from its opaque token; falls back to
// EbaySettings so a tenant not yet lazily migrated still resolves correctly.
async function findByWebhookToken(webhookToken) {
  if (!webhookToken) return null;

  const conn = await ChannelConnection.findOne({ webhook_token: webhookToken, platform: PLATFORM })
    .select(CONN_SECRET_FIELDS)
    .lean();
  if (conn) return toLegacyShape(conn);

  const legacy = await EbaySettings.findOne({ webhook_token: webhookToken }).select(SECRET_FIELDS).lean();
  if (!legacy) return null;

  try {
    const migrated = await migrateFromLegacy(legacy.tenant_id);
    return toLegacyShape(migrated);
  } catch (err) {
    logger.warn("[ebay.settings] migrateFromLegacy failed during webhook lookup — using legacy shape directly", {
      error: err.message,
    });
    return withDecryptedRefreshTokenLegacy(legacy);
  }
}

// Every eBay-enabled tenant, for the worker's poll loop. Sourced from EbaySettings (authoritative
// until the migration script runs), lazily migrating each one, plus any tenant connected directly
// through ChannelConnection with no legacy row.
async function listConfiguredTenants() {
  const legacyDocs = await EbaySettings.find({ refresh_token_ciphertext: { $ne: null } }).select(SECRET_FIELDS).lean();
  const results = [];
  const seenTenantIds = new Set();

  for (const legacy of legacyDocs) {
    seenTenantIds.add(String(legacy.tenant_id));
    try {
      let conn = await ChannelConnection.findOne({ tenant_id: legacy.tenant_id, platform: PLATFORM })
        .select(CONN_SECRET_FIELDS)
        .lean();
      if (!conn) conn = await migrateFromLegacy(legacy.tenant_id);
      results.push(toLegacyShape(conn));
    } catch (err) {
      logger.warn("[ebay.settings] ChannelConnection read failed while listing configured tenants — using legacy row", {
        tenantId: String(legacy.tenant_id),
        error: err.message,
      });
      results.push(withDecryptedRefreshTokenLegacy(legacy));
    }
  }

  const directConns = await ChannelConnection.find({
    platform: PLATFORM,
    refresh_token_ct: { $ne: null },
    tenant_id: { $nin: legacyDocs.map((d) => d.tenant_id) },
  })
    .select(CONN_SECRET_FIELDS)
    .lean();

  for (const conn of directConns) {
    if (seenTenantIds.has(String(conn.tenant_id))) continue;
    results.push(toLegacyShape(conn));
  }

  return results;
}

// Tenants with EbaySettings but no live eBay ChannelConnection (read-only).
async function listUnmigratedLegacyTenants({ tenantId = null } = {}) {
  return EbaySettings.aggregate([
    { $match: tenantId ? { tenant_id: new mongoose.Types.ObjectId(String(tenantId)) } : {} },
    {
      $lookup: {
        from: ChannelConnection.collection.collectionName,
        let: { tenant: "$tenant_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$tenant_id", "$$tenant"] }, platform: MARKETPLACE_PLATFORM.EBAY, deleted_at: null } },
          { $project: { _id: 1 } },
        ],
        as: "connection",
      },
    },
    { $match: { connection: { $size: 0 } } },
    { $project: { _id: 0, tenant_id: 1, connection_status: 1, updated_at: 1 } },
  ]);
}

module.exports = {
  listUnmigratedLegacyTenants,
  getSettings,
  upsertSettings,
  markConnectionError,
  ensureVerificationToken,
  ensureWebhookToken,
  findByWebhookToken,
  listConfiguredTenants,
  // Exported so the bulk migration script shares this implementation instead of duplicating it.
  fieldsFromLegacy,
  migrateFromLegacy,
};
