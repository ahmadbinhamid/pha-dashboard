// constants/domain.constants.js

// pending: not yet DNS-verified. active: TXT record confirmed, safe for CORS/payment-domain use.
// suspended: was active but re-verification found the TXT record missing; kept, not deleted.
const DOMAIN_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

module.exports = { DOMAIN_STATUS };
