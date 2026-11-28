// src/queues/campaign.queue.js
// Bulk campaign mail, kept off the email queue so receipts never wait on it.

const Queue = require("bull");
const { buildRedisOptions } = require("../utils/redisOptions");
const { logger } = require("../loaders/logging");
const { CAMPAIGN_JOB } = require("../constants/campaign.constants");

const redisOpts = buildRedisOptions();

const SEND_JOB_OPTS = Object.freeze({
  attempts: 4,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: true,
  removeOnFail: 500,
  timeout: 60000,
});

// Lazy: a Queue opens a socket at once, which hung tests on a mere require.
let _campaignQueue = null;
function ensureCampaignQueue() {
  if (_campaignQueue) return _campaignQueue;
  _campaignQueue = new Queue("campaign", { redis: redisOpts });
  _campaignQueue.on("error", (err) => {
    if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") return;
    logger.error("[campaignQueue] unexpected error", { error: err.message, stack: err.stack });
  });
  return _campaignQueue;
}

// Fail fast if Redis is unreachable rather than hanging the request.
function withDeadline(promise) {
  const deadline = new Promise((_, rej) =>
    setTimeout(() => rej(new Error("Campaign queue unavailable: Redis not reachable")), 4000),
  );
  return Promise.race([promise, deadline]);
}

async function enqueueFanout(runId) {
  const opts = { jobId: `fanout:${runId}`, attempts: 3, backoff: { type: "exponential", delay: 5000 }, removeOnComplete: true };
  return withDeadline(ensureCampaignQueue().add(CAMPAIGN_JOB.FANOUT, { runId: String(runId) }, opts));
}

/** jobId per run+contact, so a retried fan-out never mails anyone twice. */
async function enqueueSends(runId, contactIds) {
  const jobs = contactIds.map((contactId) => ({
    name: CAMPAIGN_JOB.SEND,
    data: { runId: String(runId), contactId: String(contactId) },
    opts: { ...SEND_JOB_OPTS, jobId: `send:${runId}:${contactId}` },
  }));
  return ensureCampaignQueue().addBulk(jobs);
}

async function enqueueTestSend(campaignId, tenantId, to) {
  const data = { campaignId: String(campaignId), tenantId: String(tenantId), to };
  return withDeadline(ensureCampaignQueue().add(CAMPAIGN_JOB.TEST, data, { attempts: 2, removeOnComplete: true }));
}

module.exports = {
  get campaignQueue() {
    return ensureCampaignQueue();
  },
  enqueueFanout,
  enqueueSends,
  enqueueTestSend,
};
