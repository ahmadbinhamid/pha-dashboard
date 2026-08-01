// constants/tenant.constants.js

const TENANT_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended",
});

const STRIPE_ONBOARDING_STATUS = Object.freeze({
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETE: "complete",
});

module.exports = { TENANT_STATUS, STRIPE_ONBOARDING_STATUS };
