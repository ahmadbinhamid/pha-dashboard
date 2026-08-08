// constants/domain.constants.js

// pending: created, not yet DNS-verified. active: TXT record confirmed —
// safe to trust for CORS/payment-domain purposes. suspended: was active but
// a re-verification found the TXT record missing (see domain.service.js) —
// kept on record rather than deleted so the tenant can see what happened
// and re-verify, instead of silently losing the domain.
const DOMAIN_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

module.exports = { DOMAIN_STATUS };
