// middlewares/pagination.js

/** Pagination middleware: reads page/limit from query, bounds them, attaches req.pagination. */
module.exports = function pagination(options = {}) {
  const defaultLimit = Number.isInteger(options.defaultLimit)
    ? options.defaultLimit
    : 15;
  const maxLimit = Number.isInteger(options.maxLimit) ? options.maxLimit : 100;

  return function paginationMiddleware(req, _res, next) {
    const rawPage = parseInt((req.query && req.query.page) || "1", 10);
    const rawLimit = parseInt(
      (req.query && req.query.limit) || String(defaultLimit),
      10
    );

    const page = Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1);
    const limit = Math.min(
      Math.max(Number.isFinite(rawLimit) ? rawLimit : defaultLimit, 1),
      maxLimit
    );
    const skip = (page - 1) * limit;

    req.pagination = { page, limit, skip };
    next();
  };
};
