// utils/http/httpError.js
// Error with an HTTP .status (read by systemfailure and the breaker).

function httpError(message, status, props = {}) {
  return Object.assign(new Error(message), { status, ...props });
}

module.exports = { httpError };
