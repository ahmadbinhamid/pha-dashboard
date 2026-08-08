// models/Domain.js
//
// A custom hostname a tenant has proven ownership of (DNS TXT record
// verification — see domain.service.js). Two consumers, both opt-in and
// both reading only ACTIVE (verified) domains:
//   1. CORS (app.js) — an active domain is accepted as a request Origin,
//      alongside the existing CORS_ALLOWED_ORIGINS env list and the
//      <slug>.PAYMENT_LINK_DOMAIN subdomain rule.
//   2. Future: Stripe Payment Method Domain registration (Apple/Google Pay
//      on a tenant's own domain) — not built yet, this model exists ahead
//      of that so the domain-ownership/verification groundwork is already
//      in place when it's needed. Modeled after flowpos-backend's
//      tenant_domain table/DomainService (DNS TXT + default-domain concept),
//      adapted to this app's Mongoose/service-layer conventions.

const { model, Schema } = require("mongoose");
const crypto = require("crypto");
const { buildSchema } = require("./base.model");
const { DOMAIN_STATUS } = require("../constants/domain.constants");

const domainSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  // Globally unique (not just per-tenant) — a hostname can only ever point
  // DNS at one place, so two tenants both "owning" the same hostname would
  // be ambiguous for both CORS and future payment-domain purposes. Lowercased
  // so "Example.com" and "example.com" can't coexist as distinct records.
  // Uniqueness enforced below via a partial index (deleted_at: null only) —
  // NOT unique: true here, which would ignore soft-deletes entirely and
  // permanently block re-registering a hostname a tenant removed. Same
  // gotcha as MarketplaceListing's external_listing_id index elsewhere in
  // this codebase.
  hostname: { type: String, required: true, trim: true, lowercase: true },
  status: {
    type: String,
    enum: Object.values(DOMAIN_STATUS),
    default: DOMAIN_STATUS.PENDING,
  },
  // Only one default domain per tenant, enforced in domain.service.js
  // (unset the previous default, then set the new one) rather than at the
  // schema level — MongoDB has no native "unique except when false" index
  // without a partial filter, and this needs cross-document coordination
  // anyway (unsetting the old default) that a schema constraint can't do.
  is_default: { type: Boolean, default: false },
  // Random per-domain secret the tenant proves ownership by publishing as
  // a DNS TXT record at _pha-verify.<hostname> — see
  // domain.service.js#getVerificationRecordName.
  verification_token: { type: String, required: true },
  verified_at: { type: Date, default: null },
});

domainSchema.index(
  { hostname: 1 },
  { unique: true, partialFilterExpression: { deleted_at: null } },
);

domainSchema.statics.generateVerificationToken = function generateVerificationToken() {
  return crypto.randomUUID();
};

module.exports = model("Domain", domainSchema);
