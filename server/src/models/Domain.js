// models/Domain.js
//
// Tenant's custom hostname, verified via DNS TXT (domain.service.js); used for CORS now (app.js), and later Stripe Payment Method Domain registration. Modeled on flowpos-backend's tenant_domain/DomainService.

const { model, Schema } = require("mongoose");
const crypto = require("crypto");
const { buildSchema } = require("./base.model");
const { DOMAIN_STATUS } = require("../constants/domain.constants");

const domainSchema = buildSchema({
  tenant_id: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
  // Globally unique hostname (lowercased); enforced via partial index below (not unique:true) so a soft-deleted hostname can be re-registered — same gotcha as MarketplaceListing's external_listing_id index.
  hostname: { type: String, required: true, trim: true, lowercase: true },
  status: {
    type: String,
    enum: Object.values(DOMAIN_STATUS),
    default: DOMAIN_STATUS.PENDING,
  },
  // Only one default per tenant, enforced in domain.service.js (unset old, set new) rather than at schema level.
  is_default: { type: Boolean, default: false },
  // Secret published as a DNS TXT record at _pha-verify.<hostname> to prove ownership; see domain.service.js#getVerificationRecordName.
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
