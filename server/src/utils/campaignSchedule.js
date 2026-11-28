// utils/campaignSchedule.js
// Next send time for a recurring campaign, in the campaign's own timezone.

const { RECURRENCE_FREQUENCY, DEFAULT_TIMEZONE } = require("../constants/campaign.constants");

const DAY_MS = 24 * 60 * 60 * 1000;

function isValidTimezone(tz) {
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Wall-clock parts of `date` as seen in `tz`. */
function zonedParts(date, tz) {
  const fmt = new Intl.DateTimeFormat("en-AU", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: weekdays.indexOf(parts.weekday),
  };
}

/** UTC instant for a wall-clock time in `tz`; two passes absorb DST shifts. */
function zonedTimeToUtc({ year, month, day, hour, minute }, tz) {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  let utc = guess;
  for (let i = 0; i < 2; i += 1) {
    const p = zonedParts(new Date(utc), tz);
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    utc += guess - seen;
  }
  return new Date(utc);
}

function parseTime(time) {
  const [h, m] = String(time || "09:00").split(":").map(Number);
  return { hour: Number.isFinite(h) ? h : 9, minute: Number.isFinite(m) ? m : 0 };
}

/** Calendar date `days` after y-m-d, timezone-free. */
function addDays({ year, month, day }, days) {
  const d = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function nextWeekly(recurrence, after, tz) {
  const { hour, minute } = parseTime(recurrence.time);
  const today = zonedParts(after, tz);
  const ahead = (recurrence.day_of_week - today.weekday + 7) % 7;
  const date = addDays(today, ahead);
  const at = zonedTimeToUtc({ ...date, hour, minute }, tz);
  return at > after ? at : zonedTimeToUtc({ ...addDays(date, 7), hour, minute }, tz);
}

function nextMonthly(recurrence, after, tz) {
  const { hour, minute } = parseTime(recurrence.time);
  const now = zonedParts(after, tz);
  let at = zonedTimeToUtc({ year: now.year, month: now.month, day: recurrence.day_of_month, hour, minute }, tz);
  if (at <= after) {
    const year = now.month === 12 ? now.year + 1 : now.year;
    const month = now.month === 12 ? 1 : now.month + 1;
    at = zonedTimeToUtc({ year, month, day: recurrence.day_of_month, hour, minute }, tz);
  }
  return at;
}

function resolveTimezone(recurrence) {
  return isValidTimezone(recurrence?.timezone) ? recurrence.timezone : DEFAULT_TIMEZONE;
}

/** First slot strictly after `after`, used when a schedule is switched on. */
function computeNextRun(recurrence, after = new Date()) {
  const tz = resolveTimezone(recurrence);
  if (recurrence?.frequency === RECURRENCE_FREQUENCY.MONTHLY) return nextMonthly(recurrence, after, tz);
  return nextWeekly(recurrence, after, tz);
}

/** Slot after a run; a stalled worker resumes from now, never catches up. */
function computeFollowingRun(recurrence, previousSlot, now = new Date()) {
  const fortnightly = recurrence?.frequency === RECURRENCE_FREQUENCY.FORTNIGHTLY;
  const from = fortnightly ? new Date(previousSlot.getTime() + 7 * DAY_MS) : previousSlot;
  const following = computeNextRun(recurrence, from);
  return following > now ? following : computeNextRun(recurrence, now);
}

module.exports = { computeNextRun, computeFollowingRun, isValidTimezone };
