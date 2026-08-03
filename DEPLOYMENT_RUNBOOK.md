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

`server/.env.production` has already been cleaned up to match everything below — this section is the reference for what "correct" looks like, in case you're diffing against an older copy or a fresh checkout.

**Remove (dead — read nowhere in `src/`, config or otherwise):**
```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PUBLISHABLE_KEY
SALES_EMAIL
EBAY_REFRESH_TOKEN
EBAY_MARKETPLACE_ID
EBAY_SANDBOX
EBAY_MERCHANT_LOCATION_KEY
EBAY_DEFAULT_CATEGORY_ID
EBAY_FULFILLMENT_POLICY_ID
EBAY_PAYMENT_POLICY_ID
EBAY_RETURN_POLICY_ID
EBAY_FALLBACK_IMAGE_URL
```
The 9 `EBAY_*` ones are leftover from the pre-OAuth single-tenant eBay setup — every one of those now lives **per-tenant** on the `EbaySettings` model (`marketplace_id`, `sandbox`, `merchant_location_key`, `fulfillment_policy_id`, `payment_policy_id`, `return_policy_id`, `fallback_image_url`, encrypted `refresh_token`), set by each tenant themselves via Settings → eBay Integration, not env vars. Only `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET`/`EBAY_REDIRECT_URI` are genuinely global (one shared eBay Application every tenant's OAuth consent authorizes against).

**Confirm present and correct for production:**
```
ENCRYPTION_KEY=<64-char hex — do NOT rotate if already set>
EBAY_CLIENT_ID=<production keyset>
EBAY_CLIENT_SECRET=<production keyset>
EBAY_REDIRECT_URI=<production RuName — from eBay Developer Portal, not a URL>
CLIENT_URL=<real production dashboard URL>
```
Currently `EBAY_CLIENT_ID`/`EBAY_CLIENT_SECRET` still hold the **sandbox** keyset (`SBX-...`) — fine while testing, but swap to the production keyset (and get a separate production `EBAY_REDIRECT_URI`/RuName for it) before any tenant needs real eBay listings to go live.

**Domain migration (`partshubaustralia.com.au` → `autopartspro.au`), dashboard only:** the project's domain going forward is `autopartspro.au` — `app.` for the dashboard, `payment.`/`*.` for payment links. `CLIENT_URL`/`UPLOADS_URL`/`PAYMENT_LINK_DOMAIN` now point at `autopartspro.au`, and `nginx.conf` has a new `app.autopartspro.au` server block.

⚠️ **`admin.partshubaustralia.com.au` has been fully removed** — its nginx block, cert references, and `CORS_ALLOWED_ORIGINS` entry are gone. **This breaks `pha-storefront`'s API calls immediately on deploy** — that separate repo still has `VITE_API_URL` hardcoded to `https://admin.partshubaustralia.com.au/api/v1`, which now resolves to nothing (the redirect block no longer lists that hostname, and no server block presents a cert for it). Rebuild and redeploy `pha-storefront` with `VITE_API_URL=https://app.autopartspro.au/api/v1` **before or immediately after** this deploy — the storefront checkout/product-browsing flow is down until then. The storefront's own domain (`partshubaustralia.com.au`/`www.`) was not touched and keeps working for anything that isn't an API call.

**New this deploy — confirm these explicitly:**
```
JWT_EXPIRES_IN=2h          # was 1d; shrinks token exposure window. No refresh-token flow
                            # exists yet, so users re-login every 2h — confirm that's acceptable.
STRIPE_DEV_WEBHOOK_SECRET=  # LEAVE UNSET/BLANK in production. Dev-only fallback for testing
                            # webhooks locally with `stripe listen` — must never be set here,
                            # or it becomes a second valid signature production would accept.
PAYMENT_LINK_DOMAIN=partshubaustralia.com.au  # New — apex domain payment links are built
                            # under (payment.<this>, or <tenant-slug>.<this> per tenant, see
                            # Tenant.payment_domain_mode). Requires the DNS + cert work below
                            # BEFORE this deploy's nginx rebuild, or nginx won't start at all.
EBAY_API_BASE_URL=          # Now left blank — was pinned to sandbox, which forced EVERY
EBAY_TAXONOMY_BASE_URL=     # tenant onto sandbox regardless of their own EbaySettings.sandbox
                            # flag. Blank lets each tenant's own flag decide. Only re-set these
                            # if you deliberately want to force one base URL platform-wide.
ALERTS_TO=                  # Still blank — set to whatever inbox should get paged on a
                            # MongoDB connection failure (the only thing that triggers it).
```

**Payment link domain — DNS + cert, do this before step 4:**
DNS is already done — GoDaddy zone for `autopartspro.au` has `A @`, `A app`, `A payment`, and `A *` all pointed at `34.116.109.117`. What's still needed is TLS: `nginx/nginx.conf` now has server blocks for `app.autopartspro.au` (cert at `/etc/letsencrypt/live/app.autopartspro.au/`) and `payment.autopartspro.au` + wildcard `*.autopartspro.au` (cert at `/etc/letsencrypt/live/wildcard.autopartspro.au/`). Nginx refuses to start if any `ssl_certificate` file it references is missing — since this is the *same* nginx.conf serving the storefront and legacy admin blocks too, a missing cert takes the whole site down, not just the new domain.

1. Issue a cert for `app.autopartspro.au` (regular HTTP-01 is fine, it's not a wildcard) — e.g. `certbot certonly --nginx -d app.autopartspro.au`.
2. Issue a wildcard cert via DNS-01 challenge for `payment.`/`*.` (HTTP-01 cannot validate a wildcard) — e.g. `certbot certonly --manual --preferred-challenges dns -d '*.autopartspro.au' -d autopartspro.au --cert-name wildcard.autopartspro.au`, using whatever ACME method your DNS provider supports (`--dns-<provider>` plugin if available, avoids the manual TXT-record dance).
3. Confirm both land at the exact paths `nginx.conf` expects — adjust the `--cert-name` above or the paths in `nginx.conf` to match, whichever is easier on your setup.
4. Set up renewal (`certbot renew` cron/systemd timer) for both — the wildcard via DNS-01 still expires every ~90 days same as any other cert.
5. The bare `autopartspro.au` apex (landing page) has its DNS `A` record but **no nginx server block yet** — out of scope here since it's not part of the dashboard; needs its own block (or separate deploy) before it'll actually serve anything.

Only then proceed to step 4 and rebuild the `nginx` container — a `docker compose config` / `nginx -t` dry run first is worth it given the shared-blast-radius risk above.

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
- **Payment domain:** every tenant defaults to the shared `payment.<domain>` link (no action needed). A tenant can opt into `<their-slug>.<domain>` links themselves in Settings → Payment Settings — nothing to do here unless a tenant asks.

## 8. Post-deploy smoke test

- [ ] Log in as an existing tenant admin — dashboard, inventory, orders, activity log all show only that tenant's data.
- [ ] `/register` creates a new tenant + admin user, logs straight in, and that new tenant's Dashboard/Inventory/Locations/Settings are all empty (not showing another tenant's data).
- [ ] Create a product with a custom vehicle make/model as a second tenant; confirm the first tenant's vehicle-model dropdown does **not** show it, but the shared/global makes still do for both.
- [ ] Trigger a Stripe test payment + refund end-to-end for one tenant.
- [ ] Confirm eBay poll/webhook logs show no errors after restart (`docker compose logs worker-ebay`).
