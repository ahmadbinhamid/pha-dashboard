// utils/gracefulShutdown.test.js
// Real Bull queue (unique name): drains, takes nothing new, bounded wait.

const test = require("node:test");
const { after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Queue = require("bull");
const { buildRedisOptions } = require("./redisOptions");
const { createShutdown } = require("./gracefulShutdown");

const SILENT = { info() {}, warn() {}, error() {} };
const cleanups = [];
after(async () => {
  for (const cleanup of cleanups) await cleanup();
});

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A worker queue plus a separate producer; both removed from Redis afterwards.
async function makeQueues() {
  const name = `test-shutdown-${crypto.randomUUID()}`;
  const worker = new Queue(name, { redis: buildRedisOptions() });
  const producer = new Queue(name, { redis: buildRedisOptions() });
  await Promise.all([worker.isReady(), producer.isReady()]);
  cleanups.push(async () => {
    await producer.obliterate({ force: true });
    await Promise.all([worker.close(true), producer.close()]);
  });
  return { worker, producer };
}

async function waitFor(check, timeoutMs = 5000) {
  const started = Date.now();
  while (!(await check())) {
    if (Date.now() - started > timeoutMs) throw new Error("timed out waiting");
    await wait(20);
  }
}

function harness(queues, timeoutMs) {
  const events = [];
  const shutdown = createShutdown({
    name: "testWorker",
    getQueues: () => queues,
    timeoutMs,
    closeConnections: async () => events.push("connections closed"),
    exit: (code) => events.push(`exit ${code}`),
    logger: { ...SILENT, warn: (msg) => events.push(`warn: ${msg}`) },
  });
  return { shutdown, events };
}

test("SIGTERM lets the in-flight job finish, then exits 0", async () => {
  const { worker, producer } = await makeQueues();
  const done = [];
  void worker.process(async (job) => {
    await wait(400);
    done.push(job.data.n);
  });
  await producer.add({ n: 1 });
  await waitFor(async () => (await producer.getActiveCount()) === 1);

  const { shutdown, events } = harness([worker], 5000);
  await shutdown("SIGTERM");

  assert.deepEqual(done, [1], "the active job completed before exit");
  assert.deepEqual(events, ["connections closed", "exit 0"]);
});

test("no new job is taken after the signal", async () => {
  const { worker, producer } = await makeQueues();
  const started = [];
  void worker.process(async (job) => {
    started.push(job.data.n);
    await wait(300);
  });
  await producer.add({ n: 1 });
  await waitFor(async () => started.length === 1);

  const { shutdown, events } = harness([worker], 5000);
  const stopping = shutdown("SIGTERM");
  await producer.add({ n: 2 });
  await stopping;
  await wait(300);

  assert.deepEqual(started, [1], "job 2 was never picked up");
  assert.equal(await producer.getWaitingCount(), 1, "job 2 is still waiting for the next worker");
  assert.equal(events.at(-1), "exit 0");
});

test("a job outlasting the timeout doesn't block exit", async () => {
  const { worker, producer } = await makeQueues();
  let finished = false;
  void worker.process(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10_000).unref());
    finished = true;
  });
  await producer.add({ n: 1 });
  await waitFor(async () => (await producer.getActiveCount()) === 1);

  const { shutdown, events } = harness([worker], 300);
  const startedAt = Date.now();
  await shutdown("SIGTERM");

  assert.ok(Date.now() - startedAt < 3000, `exited after ${Date.now() - startedAt}ms`);
  assert.equal(finished, false);
  assert.match(events[0], /outlasted 300ms/);
  assert.equal(events.at(-1), "exit 0");
});

test("a second signal forces exit", async () => {
  const { worker, producer } = await makeQueues();
  void worker.process(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10_000).unref());
  });
  await producer.add({ n: 1 });
  await waitFor(async () => (await producer.getActiveCount()) === 1);

  const { shutdown, events } = harness([worker], 5000);
  const first = shutdown("SIGTERM");
  await wait(50);
  await shutdown("SIGINT");
  assert.ok(events.includes("exit 1"), JSON.stringify(events));
  void first;
});
