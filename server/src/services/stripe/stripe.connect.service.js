// services/stripe/stripe.connect.service.js
//
// Stripe Connect, controller-based accounts (same pattern as flowpos-backend's
// HasMainAccount trait): one platform Stripe account (config.stripe.secretKey)
// creates a connected account per tenant, with the platform absorbing fees/
// losses and no Stripe-hosted dashboard for the merchant — onboarding happens
// entirely inside our own dashboard via Stripe's embedded Account Sessions.

const { getStripeClient } = require("./stripe.client.service");
const { STRIPE_ONBOARDING_STATUS } = require("../../constants/tenant.constants");

async function createConnectedAccount(tenant, { country = "AU" } = {}) {
  if (tenant.stripe_account_id) {
    throw Object.assign(new Error("This tenant already has a connected Stripe account"), { status: 409 });
  }

  const stripe = getStripeClient();
  const account = await stripe.accounts.create({
    controller: {
      losses: { payments: "application" },
      fees: { payer: "application" },
      stripe_dashboard: { type: "none" },
      requirement_collection: "application",
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    country,
  });

  tenant.stripe_account_id = account.id;
  tenant.stripe_onboarding_status = STRIPE_ONBOARDING_STATUS.IN_PROGRESS;
  await tenant.save();

  return account;
}

// Short-lived client_secret for Stripe's embedded onboarding component
// (@stripe/connect-js on the frontend) — fetched fresh every time the
// onboarding panel mounts, never persisted.
async function createAccountSession(tenant) {
  if (!tenant.stripe_account_id) {
    throw Object.assign(new Error("This tenant has no connected Stripe account yet"), { status: 409 });
  }

  const stripe = getStripeClient();
  const accountSession = await stripe.accountSessions.create({
    account: tenant.stripe_account_id,
    components: {
      account_onboarding: {
        enabled: true,
        features: {
          disable_stripe_user_authentication: true,
          external_account_collection: true,
        },
      },
    },
  });

  return accountSession.client_secret;
}

// Polled by the frontend's status card after onboarding — also called to
// refresh tenant.stripe_charges_enabled/payouts_enabled/onboarding_status.
async function getAccountStatus(tenant) {
  if (!tenant.stripe_account_id) {
    return {
      connected: false,
      onboarding_status: STRIPE_ONBOARDING_STATUS.NOT_STARTED,
      charges_enabled: false,
      payouts_enabled: false,
    };
  }

  const stripe = getStripeClient();
  const account = await stripe.accounts.retrieve(tenant.stripe_account_id);

  const onboardingComplete = !!(account.charges_enabled && account.payouts_enabled);
  tenant.stripe_charges_enabled = !!account.charges_enabled;
  tenant.stripe_payouts_enabled = !!account.payouts_enabled;
  tenant.stripe_onboarding_status = onboardingComplete
    ? STRIPE_ONBOARDING_STATUS.COMPLETE
    : STRIPE_ONBOARDING_STATUS.IN_PROGRESS;
  await tenant.save();

  return {
    connected: true,
    onboarding_status: tenant.stripe_onboarding_status,
    charges_enabled: tenant.stripe_charges_enabled,
    payouts_enabled: tenant.stripe_payouts_enabled,
    requirements_due: account.requirements?.currently_due || [],
  };
}

module.exports = { createConnectedAccount, createAccountSession, getAccountStatus };
