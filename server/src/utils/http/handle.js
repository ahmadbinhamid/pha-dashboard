// utils/http/handle.js
// Shared controller plumbing: the success/failure envelope and page shape.

const { success, created, systemfailure } = require("./response");

/** Wraps a service call (given req) in the usual success/failure reply. */
const handle =
  (run, { message = "OK", status = "ok" } = {}) =>
  async (req, res) => {
    try {
      const data = await run(req);
      return status === "created" ? created(res, data, message) : success(res, data, message);
    } catch (err) {
      return systemfailure(res, err);
    }
  };

/** The app's paged list shape, from req.pagination and a service result. */
function toPage({ page, limit }, { items, total }) {
  return { items, total, page, pageSize: limit, totalPages: Math.max(Math.ceil(total / limit), 1) };
}

module.exports = { handle, toPage };
