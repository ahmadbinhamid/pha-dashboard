// validators/domain.validation.js

const Joi = require("joi");

// RFC 1123-ish hostname — letters/digits/hyphens per label, dot-separated,
// no scheme/path/port (this is a bare hostname for DNS + Origin matching,
// not a URL).
const HOSTNAME_PATTERN = /^(?!-)[a-zA-Z0-9-]{1,63}(?<!-)(\.(?!-)[a-zA-Z0-9-]{1,63}(?<!-))+$/;

const createDomain = {
  body: Joi.object({
    hostname: Joi.string().trim().lowercase().pattern(HOSTNAME_PATTERN).max(253).required().messages({
      "string.pattern.base": "Enter a valid domain (e.g. shop.example.com)",
    }),
  }),
};

const domainIdParam = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

module.exports = { createDomain, domainIdParam };
