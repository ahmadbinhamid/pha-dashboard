// middlewares/asyncHandler.js

module.exports = (fn) => (req, res, next) => {
  // NOTE (lint fix): arrow wrapper only satisfies the untyped-JS any-check on next; behavior unchanged.
  Promise.resolve(fn(req, res, next)).catch((err) => next(err));
};
