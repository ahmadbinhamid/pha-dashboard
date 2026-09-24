// services/inventory-digest.service.js
// Sends each tenant's low-stock digest once per UTC day at their send time.

const { logger } = require("../loaders/logging");
const config = require("../config");
const InventorySettings = require("../models/InventorySettings");
const inventoryService = require("./inventory.service");
const { getCompanyProfile } = require("./tenantSettings.service");
const { buildLowStockReportPdfBuffer } = require("../utils/pdf/lowStockReportPdf");
const emailService = require("./email/email.service");

function startOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// "HH:MM" (UTC, as stored) -> minutes since UTC midnight.
function minutesOfDay(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// A tenant's error mustn't abort the sweep. NOTE: now/tenantIds are test seams.
async function sweepLowStockDigests({ now = new Date(), tenantIds = null } = {}) {
  // Checked before any query: a cheap kill switch.
  if (!config.inventory.digestSweepEnabled) {
    logger.info("[inventory-digest.service] sweep disabled via INVENTORY_DIGEST_SWEEP_ENABLED — skipping");
    return { skipped: true, reason: "sweep_disabled" };
  }

  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const today = startOfUtcDay(now);

  // Cursor, not .find(): worker has a 256MB heap cap and must scale by tenants.
  const query = { email_notifications: true };
  if (tenantIds) query.tenant_id = { $in: tenantIds };
  const cursor = InventorySettings.find(query).cursor();

  const summary = { sent: 0, skipped: 0, errored: 0 };
  for (let settings = await cursor.next(); settings != null; settings = await cursor.next()) {
    try {
      const result = await maybeSendDigest(settings, nowMinutes, today);
      if (result === "sent") summary.sent++;
      else summary.skipped++;
    } catch (err) {
      summary.errored++;
      logger.error(`[inventory-digest.service] tenant ${settings.tenant_id}: digest failed: ${err.message}`, {
        stack: err.stack,
      });
    }
  }

  logger.info(
    `[inventory-digest.service] sweep complete: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.errored} errored`,
  );
  return { ok: true, ...summary };
}

async function maybeSendDigest(settings, nowMinutes, today) {
  const tenantId = settings.tenant_id;

  // Dedup: at most once per UTC calendar day, whatever the sweep frequency.
  if (settings.last_digest_sent_at && settings.last_digest_sent_at >= today) {
    return "already_sent_today";
  }

  // No upper bound: a missed tick self-heals; the dedup above stops double-sends.
  const sendMinutes = minutesOfDay(settings.notification_send_time);
  if (nowMinutes < sendMinutes) {
    return "not_due";
  }

  if (!settings.notification_email) {
    logger.warn(
      `[inventory-digest.service] tenant ${tenantId}: email_notifications is on but notification_email is empty — skipping`,
    );
    return "no_recipient";
  }

  const items = await inventoryService.getLowStockItems(tenantId, settings.low_stock_threshold);

  if (items.length === 0) {
    // Stamp even with no email so healthy tenants aren't re-queried every tick.
    settings.last_digest_sent_at = new Date();
    await settings.save();
    return "no_low_stock";
  }

  const companyProfile = await getCompanyProfile(tenantId);
  const pdfBuffer = await buildLowStockReportPdfBuffer(items, {
    companyProfile,
    threshold: settings.low_stock_threshold,
  });
  await emailService.sendLowStockDigest({
    to: settings.notification_email,
    items,
    companyProfile,
    pdfBase64: pdfBuffer.toString("base64"),
    pdfFilename: `low-stock-report-${today.toISOString().slice(0, 10)}.pdf`,
  });

  settings.last_digest_sent_at = new Date();
  await settings.save();
  return "sent";
}

module.exports = { sweepLowStockDigests, maybeSendDigest };
