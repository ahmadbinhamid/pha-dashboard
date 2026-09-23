// services/inventory-digest.service.js
// Sweeps every tenant's InventorySettings periodically and sends that tenant's low-stock
// digest exactly once per UTC calendar day, at their configured send time. Wired as a repeatable
// job in workers/platform.worker.js, mirroring refresh.service.js's role for channel.worker.js.

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

// Sweeps every tenant with email_notifications on; per-tenant try/catch below must not abort
// the sweep for everyone else, same shape as refresh.service.js#sweepStaleListings.
async function sweepLowStockDigests() {
  // Checked first, before any query — same cheap escape-hatch reasoning as refresh.service.js's kill switch.
  if (!config.inventory.digestSweepEnabled) {
    logger.info("[inventory-digest.service] sweep disabled via INVENTORY_DIGEST_SWEEP_ENABLED — skipping");
    return { skipped: true, reason: "sweep_disabled" };
  }

  const now = new Date();
  const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const today = startOfUtcDay(now);

  // Cursor, not .find() into an array — the worker runs with a 256MB heap cap and must scale with tenant count.
  const cursor = InventorySettings.find({ email_notifications: true }).cursor();

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

  // Dedup — never more than once per UTC calendar day, regardless of sweep frequency.
  if (settings.last_digest_sent_at && settings.last_digest_sent_at >= today) {
    return "already_sent_today";
  }

  // No upper bound on this check, just "past the configured time today" — an upper-bounded
  // window wouldn't self-heal a missed sweep tick, and the dedup check above prevents double-sends anyway.
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
    // Still stamped "done for today" even with no email sent, so a healthy tenant isn't
    // re-queried on every sweep tick — a same-day stock drop just waits until tomorrow's digest.
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
