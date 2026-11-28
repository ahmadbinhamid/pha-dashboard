// utils/campaignSchedule.test.js
// Recurring sends land on the store's wall clock, across DST, never twice.

const test = require("node:test");
const assert = require("node:assert/strict");
const { computeNextRun, computeFollowingRun } = require("./campaignSchedule");

const SYDNEY = "Australia/Sydney";
const local = (date, tz = SYDNEY) =>
  date.toLocaleString("en-AU", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

test("weekly: next Monday 9am Sydney, strictly after now", () => {
  const r = { frequency: "weekly", day_of_week: 1, time: "09:00", timezone: SYDNEY };
  const next = computeNextRun(r, new Date("2026-11-28T00:00:00Z"));
  assert.equal(next.toISOString(), "2026-11-29T22:00:00.000Z");
  assert.match(local(next), /Mon.*9:00/);
  const again = computeNextRun(r, next);
  assert.equal(again - next, 7 * 86_400_000);
});

test("fortnightly: the slot after a run is 14 days on", () => {
  const r = { frequency: "fortnightly", day_of_week: 1, time: "09:00", timezone: SYDNEY };
  const first = computeNextRun(r, new Date("2026-11-28T00:00:00Z"));
  const second = computeFollowingRun(r, first, first);
  assert.equal(second - first, 14 * 86_400_000);
});

test("monthly: same day each month at the same local time", () => {
  const r = { frequency: "monthly", day_of_month: 1, time: "08:30", timezone: SYDNEY };
  const first = computeNextRun(r, new Date("2026-11-28T00:00:00Z"));
  assert.match(local(first), /1 Dec.*8:30/);
  assert.match(local(computeFollowingRun(r, first, first)), /1 Jan.*8:30/);
});

test("keeps 9am local across the daylight-saving change", () => {
  const r = { frequency: "weekly", day_of_week: 0, time: "09:00", timezone: SYDNEY };
  const before = computeNextRun(r, new Date("2026-09-24T00:00:00Z"));
  const after = computeFollowingRun(r, before, before);
  assert.match(local(before), /9:00/);
  assert.match(local(after), /9:00/);
  assert.equal(after - before, 7 * 86_400_000 - 3_600_000);
});

test("a worker down for weeks resumes from now instead of catching up", () => {
  const r = { frequency: "weekly", day_of_week: 1, time: "09:00", timezone: SYDNEY };
  const stale = new Date("2026-10-05T22:00:00Z");
  const now = new Date("2026-11-28T00:00:00Z");
  const next = computeFollowingRun(r, stale, now);
  assert.ok(next > now);
  assert.equal(next.toISOString(), "2026-11-29T22:00:00.000Z");
});
