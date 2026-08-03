# Deployment Runbook

## 0. Before you start

⚠️ **Known open issue (unrelated to this deploy):** 82 real orders (`PHA-00012`–`PHA-00093`) were found missing from the dev database during this session, with no corresponding delete command issued from here. Investigate and resolve on your end before treating this environment's data as trustworthy for a production cutover.

⚠️ **Business decision needed:** this deploy makes `/auth/register-tenant` live — **anyone on the internet can create a new tenant on your production system**, no invite/approval step. If that's not what you want yet, gate or disable that route before deploying (see step 3).

## 1. Back up the database first

```bash
docker compose exec -T mongo mongodump --archive --gzip > backup-$(date +%Y%m%d-%H%M%S).archive.gz
```
Copy that file off the server (scp/S3) before continuing. Given the data-loss note above, verify this backup actually contains what you expect before relying on it.

## 2. Commit and push your changes

```bash
git add -A
git commit -m "your message"
git push
```
(then pull/deploy that commit on the server per your normal flow)

## 3. Update `server/.env.production`

**Remove (dead):**
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PUBLISHABLE_KEY
SALES_EMAIL
```

**Confirm present and correct for production:**
```
ENCRYPTION_KEY=<64-char hex — do NOT rotate if already set>
EBAY_CLIENT_ID=<production keyset>
EBAY_CLIENT_SECRET=<production keyset>
EBAY_REDIRECT_URI=<production RuName>
CLIENT_URL=<real production dashboard URL>
```

**New this deploy — confirm these explicitly:**
```
JWT_EXPIRES_IN=2h          # was 1d; shrinks token exposure window. No refresh-token flow
                            # exists yet, so users re-login every 2h — confirm that's acceptable.
STRIPE_DEV_WEBHOOK_SECRET=  # LEAVE UNSET/BLANK in production. Dev-only fallback for testing
                            # webhooks locally with `stripe listen` — must never be set here,
                            # or it becomes a second valid signature production would accept.
```

**Leave unchanged:** `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS` (platform mailbox, still used for OTP/password-reset/alerts).

**Rate limiting** (new dependency `express-rate-limit`) needs no env config — it's active by default on `/auth/*` (5 attempts/15min) and the guest payment-intent endpoint (10/min).

**Self-service signup decision** (see step 0): if you want `/auth/register-tenant` gated for now rather than fully public, comment out its route registration in `server/src/routes/auth.routes.js` before building, or add your own gate (invite code / feature flag) — nothing in the current code restricts who can call it beyond rate limiting.

## 4. Rebuild and restart containers

```bash
docker compose build backend worker-email worker-ebay worker-stripe nginx
docker compose up -d
```
`nginx`'s build already compiles the dashboard frontend (`Dockerfile.frontend` runs `npm run build`), so this picks up the new Register page automatically — no separate frontend build step needed. (The storefront, `pha-storefront`, is a separate repo/deploy; nothing from this session requires a storefront redeploy, since no storefront code changed — only backend responses it already consumes.)

## 5. Sync indexes

```bash
docker compose exec backend node scripts/syncIndexes.js
```
Production disables Mongoose `autoIndex` (`loaders/mongoose.js`), so this is the only thing that actually applies index changes there — and it's the one step covering **all** of this session's index changes in one run: `Tenant.stripe_webhook_token` (was `sparse`, now a proper partial-filter unique index — the old one would've blocked ever creating a second tenant), `EbayProcessedOrder` (dedup key now includes SKU), `VehicleModel` (global-unique → per-tenant-unique), plus the new `Location`/`Attachment`/`InventorySettings`/`Product`/`Order` indexes. Safe to re-run any time; it's a no-op for indexes already matching the schema, and drops stale ones automatically.

## 6. Data migrations — **run these, in order** (replaces the old "no backfill needed")

This session added `tenant_id` to several previously-unscoped collections and converted one global singleton to per-tenant. All of the following are idempotent — safe to re-run.

```bash
# 1. Backfill tenant_id onto Location and Attachment (and re-verify the
#    already-migrated collections are still clean). Use your real
#    production tenant's _id.
docker compose exec backend node scripts/backfillTenantId.js <tenantId>

# 2. Convert the InventorySettings global singleton to that same tenant.
docker compose exec backend node scripts/migrateInventorySettingsToPerTenant.js <tenantId>

# 3. Check for (and optionally fix) order/invoice/refund counter drift —
#    the exact bug that caused a live E11000 duplicate-key error on this
#    project's dev DB the moment a fresh order tried to use the correct
#    per-tenant counter while real orders had drifted ahead of it on an old
#    unnamespaced key. Report-only by default:
docker compose exec backend node scripts/checkCounterDrift.js
# If it reports drift, re-run with --fix:
docker compose exec backend node scripts/checkCounterDrift.js --fix
```

Do this **before** resuming real traffic if possible — until it runs, any *update* to a pre-existing Location/Attachment/InventorySettings document (not new-document creation, which is unaffected) would fail Mongoose's `required: true` validation.

## 7. Manual, per-tenant, after deploy

- **Stripe:** each tenant re-enters their own secret/publishable key in Settings → Payment Account.
- **Email:** each tenant optionally sets up their own SMTP in Settings → Email Settings (falls back to platform mailbox until they do).
- **eBay:** reconnect if production keyset/RuName differ from what was tested earlier.

## 8. Post-deploy smoke test

- [ ] Log in as an existing tenant admin — dashboard, inventory, orders, activity log all show only that tenant's data.
- [ ] `/register` creates a new tenant + admin user, logs straight in, and that new tenant's Dashboard/Inventory/Locations/Settings are all empty (not showing another tenant's data).
- [ ] Create a product with a custom vehicle make/model as a second tenant; confirm the first tenant's vehicle-model dropdown does **not** show it, but the shared/global makes still do for both.
- [ ] Trigger a Stripe test payment + refund end-to-end for one tenant.
- [ ] Confirm eBay poll/webhook logs show no errors after restart (`docker compose logs worker-ebay`).
