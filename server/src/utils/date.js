// utils/date.js
// Calendar arithmetic shared by services.

/** A new Date `days` calendar days after `date`, keeping the time of day. */
function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

module.exports = { addDays };
