# Channel architecture

This document describes the channel-agnostic layer that replaces eBay-specific
plumbing throughout the marketplace-sync stack, so Google Shopping and Meta
Shop (built later) plug into the same contract eBay now does. It covers the
adapter contract, the data model, the job/queue flow, the deploy order, and
the rollback procedure.

eBay's own behavior is unchanged end-to-end by this migration — every
existing eBay flow (publish, update, end, inventory push, inventory
poll-back, order ingest, webhooks, refunds) still works exactly as it did
before. What changed is *where* the generic parts of that plumbing live.

## 1. Adapter contract

Every marketplace adapter (`services/marketplace/adapters/*.adapter.js`)
exports:

```js
{
  key,            // platform key, e.g. "ebay"
  manifest,       // { key, name, logo, description, status, authType, setupSteps, requiredTenantData }
  capabilities,   // { publish, inventory, batch, orders, webhooks, inboundInventory, variants }
  loadSettings(tenantId), // -> resolved connection/settings object, or null if not connected
  publish(resolved, settings, hooks?, seq?),
  update(resolved, settings, hooks?, seq?),
  end(listing),
  publishBatch(...), // optional — omitted by eBay
}
```

`registry.js` (`services/marketplace/registry.js`) holds every registered
adapter:

- `register(adapter)` — called once at process startup (see
  `services/marketplace/registerAdapters.js`, used by both the API process
  and the channel worker).
- `has(platform)` / `get(platform)` (alias: `getAdapter`) — `get` throws a
  clear "No marketplace adapter registered for: X" error for an unknown
  platform; `has` is the non-throwing check used by fan-out and the channel
  routes.
- `list()` — every registered adapter's `manifest`, used by `GET
  /api/v1/channels`.
- `getAll()` — every registered adapter object, used by the worker to attach
  a queue processor per platform.

`services/marketplace/sync.service.js` is the platform-agnostic dispatcher.
It no longer has any eBay-specific branching: it resolves the adapter via
the registry, calls `adapter.loadSettings(tenantId)` instead of a hardcoded
per-platform switch, and guards on `adapter.capabilities.inventory` so a
catalog-only adapter's inventory-refresh jobs become a clean no-op instead of
a crash. A tenant with no connection at all (`loadSettings` resolves to
`null`) is a clean "not connected" skip, never an unhandled rejection.

eBay's own adapter (`adapters/ebay.adapter.js`) still owns every eBay HTTP
call exactly as before; the only additions are `manifest`, `capabilities`
(`publish`/`inventory`/`orders`/`webhooks`/`inboundInventory`/`variants`:
`true`, `batch`: `false`), and `loadSettings`, which just wraps the existing
`ebay.settings.service.js#getSettings` — see the `// NOTE:` in that file for
why it deliberately never returns `null` (an unconfigured eBay tenant still
gets today's exact "credentials not configured" error/retry behavior, not
the new generic skip, since that's what "zero behavior change" requires).

## 2. Data model

### MarketplaceListing (existing collection, unchanged name)

`push_seq` / `last_pushed_seq` moved from the eBay discriminator onto the
**base** schema (default `0`) — `sync.service.js` reads them for every
platform, so a non-eBay listing used to silently get `undefined` fencing
values. A generic `synced_quantity` field was added to the base schema as
the channel-agnostic loop-prevention baseline.

`ebay_synced_quantity` stays on the eBay discriminator, marked deprecated.
During the transition every write site dual-writes both
`ebay_synced_quantity` (deprecated) and `synced_quantity` (generic) —
search for `TODO(dual-write)` to find every site. The read convention going
forward is `synced_quantity ?? ebay_synced_quantity ?? null`.
`ebay.inventory-sync.service.js` (the existing eBay-only reconciliation
poller) was left reading `ebay_synced_quantity` directly — untouched, since
generalizing that poller isn't in scope here and the dual-write keeps it
accurate regardless.

Every fencing comparison coalesces with `?? 0` rather than assuming Mongoose
applies the schema default on every read path (it does on a hydrated
document, not on `.lean()`).

New indexes (background): `{ tenant_id, platform, sync_status }` and
`{ tenant_id, platform, synced_at: -1 }`.

### ChannelConnection (new collection, discriminator key `platform`)

Replaces `EbaySettings` as the channel-agnostic connection record. Base
schema: `tenant_id`, `platform`, `status`
(`connected`/`disconnected`/`degraded`/`error`), `external_account_id`,
`access_token_ct` / `refresh_token_ct` (single packed ciphertext string per
token — see §3), `token_expires_at`, `webhook_token`, `connected_at`,
`last_error`, `consecutive_failures`, `last_success_at`, `disabled_at`.
Unique index on `{ tenant_id, platform }`; a separate global unique+sparse
index on `webhook_token` (it has no tenant in its own URL, so it must be
resolvable on its own — see §3).

The eBay discriminator carries every eBay-specific field from
`EbaySettings.js` verbatim: `marketplace_id`, `sandbox`,
`merchant_location_key`, the three business policy ids, the warehouse
address fields, `fallback_image_url`, `verification_token`.

It's registered under the Mongoose model name `ChannelConnectionEbay`, not
`ebay` — `MarketplaceListing` already has a discriminator model literally
named `ebay`, and Mongoose discriminator names are unique per connection,
not per base model, so reusing the same name throws `OverwriteModelError`.
The 3rd argument to `.discriminator(name, schema, value)` keeps the actual
stored `platform` value as `"ebay"` (`MARKETPLACE_PLATFORM.EBAY`) — every
query elsewhere is unaffected.

### ChannelSyncLog (new collection)

Append-only audit trail written from `sync.service.js`: `tenant_id`,
`platform`, `job_type`, `entity_type`, `entity_id`, `status`
(`success`/`failure`/`skipped`), `attempt`, `error_code`, `error_message`,
`request_summary`, `duration_ms`. TTL index on `created_at`
(`config.channels.syncLogTtlDays`, default 30). Failures are always logged
in full; successes/skips only when `config.channels.logSuccesses` is set
(default `false`), so a full catalogue sync doesn't write thousands of rows.
All log writes are wrapped in try/catch — logging can never break a job.

### EbaySettings (existing collection, untouched)

Left in place as the legacy source of truth during the transition — not
deleted, not modified. See §4.

## 3. Migration strategy: EbaySettings → ChannelConnection

Lazy read-through, because the system is live and cannot take a maintenance
window:

- **Read** (`ebay.settings.service.js#getSettings`): look up
  `ChannelConnection { tenant_id, platform: "ebay" }`. If absent, read the
  legacy `EbaySettings` doc, upsert it into `ChannelConnection` (idempotent —
  `findOneAndUpdate` with `$setOnInsert`, protected by the unique index; a
  concurrent duplicate-key error is caught and re-read rather than erring),
  and return that.
- **Write** (`upsertSettings`, `markConnectionError`,
  `ensureVerificationToken`, `ensureWebhookToken`): `ChannelConnection`
  only — but `upsertSettings` first calls `ensureMigrated`, which runs the
  same lazy migration if no `ChannelConnection` row exists yet. Without
  this, a partial update (e.g. "just change the warehouse phone number") on
  a tenant who's already connected via the legacy row, but hasn't triggered
  a lazy migration yet, would silently create a bare `ChannelConnection`
  missing their refresh token — orphaning a live connection.
- **`findByWebhookToken`**: tries `ChannelConnection` first, falls back to
  `EbaySettings` (and lazily migrates on the way) — a real inbound eBay
  webhook delivery must resolve correctly immediately after this code
  deploys, for every already-connected tenant, none of whom have a
  `ChannelConnection` row yet at that point.
- **`listConfiguredTenants`**: sourced from `EbaySettings` (authoritative
  until the bulk migration script runs), lazily migrating each tenant along
  the way; also includes any tenant connected directly through
  `ChannelConnection` with no legacy row at all.
- The lazy migration **never throws into the caller's request path** — every
  call site falls back to reading `EbaySettings` directly on failure.

**Public shape is unchanged.** `getSettings`/`upsertSettings`/
`findByWebhookToken` still return the exact same field names/values
(`marketplace_id`, `sandbox`, `connection_status`, `refresh_token`, ...) as
before — the frontend (`ebaySettingsService.ts` et al) is untouched and
still reads this shape. `toLegacyShape()`/`fieldsFromLegacy()` in
`ebay.settings.service.js` are the one place that translates between the two
models.

**Token ciphertext**: `tokenCipher.js` is unchanged and still produces
`{ ciphertext, iv, tag }`. `ChannelConnection`'s generic contract has a
single `refresh_token_ct` string (shared across every future platform's
cipher shape), so the three parts are packed into one delimited string
(`"<iv>.<tag>.<ciphertext>"`, base64 never contains `.`) rather than
widening the schema for one platform. This is a repackaging, not a
decrypt/re-encrypt — the underlying AES-GCM ciphertext bytes are copied
verbatim.

**Bulk migration script** —
`server/scripts/migrateEbaySettingsToChannelConnection.js`:

```
node scripts/migrateEbaySettingsToChannelConnection.js [--dry-run] [--tenant=<tenantId>]
```

Idempotent (skips a tenant that already has a `ChannelConnection`, never
overwrites it), `--dry-run` writes nothing, logs a per-tenant and summary
count. Exports `run({ dryRun, tenantId, log, logError })` so it's testable
directly rather than only as a subprocess — see
`src/services/ebay/ebay.settings.migration-script.test.js`.

## 4. Job / queue flow

`queues/channel.queue.js` exports a `queues` map keyed by platform and
`enqueueChannelJob(platform, jobName, payload, opts)`. eBay's Bull queue
name stays exactly `"ebay"` (job names `sync_listing`/`poll_orders`/
`poll_inventory` unchanged too) — there can be jobs already sitting in Redis
at deploy time, and renaming the queue would orphan them.

`sync_listing` jobs are debounced: `jobId: sync:<platform>:<listingId>`,
`delay: config.channels.debounceMs` (default 5000ms), `removeOnComplete:
true` (**mandatory** — a completed job with a custom jobId stays in Redis's
completed set otherwise, and a later `.add()` with the same id is silently
ignored forever), `removeOnFail: false`. N rapid calls for the same listing
collapse into one job; the eventual job re-reads the listing's *current*
`push_seq` at execution time rather than trusting whichever payload's `seq`
happened to win the dedup, so this is safe. The old job-payload shape
(`{ listingId, seq }`) is unchanged and still processed correctly by the
worker.

`queues/ebay.queue.js` is now a thin shim: `enqueueEbayJob` calls
`channel.queue.js`'s `enqueueChannelJobDirect("ebay", ...)` (the real
implementation, bypassing override-checking), and the module registers
itself as the `"ebay"` override on `channel.queue.js` so a caller of the
generic `enqueueChannelJob("ebay", ...)` (e.g.
`inventory.service.js#fanOutMarketplaceInventory`) is transparently routed
through the exact same function object several **pre-existing tests**
already mock directly (`ebay.inventory-sync.service.test.js`,
`inventory.service.oversell.test.js` both patch
`ebay.queue.js#enqueueEbayJob`). This indirection exists purely so those
tests keep intercepting real eBay-bound enqueue calls without being edited
— it has no effect on production behavior (both paths hit the identical Bull
queue with identical job options either way).

Per-queue rate limiting (`limiter: { max, duration }`) is read from
`config.channels.rateLimits[platform]`; eBay's has never had one, so it
stays unset by default — set `EBAY_QUEUE_RATE_MAX`/`_DURATION_MS` to opt in.

### Inventory fan-out

`inventory.service.js#fanOutMarketplaceInventory` now calls
`enqueueChannelJob(listing.platform, ...)` instead of a hardcoded
`enqueueEbayJob`. It iterates every active listing across every platform for
a product; a listing whose platform has no registered adapter is skipped
with a warning (never throws), and each platform's enqueue is wrapped
individually so one platform's failure never blocks another's.

### Circuit breaker (`services/marketplace/circuitBreaker.js`)

Per-`(tenant, platform)`, backed by `ChannelConnection.consecutive_failures`/
`status`. Only transport/auth-level failures count (`status >= 500`, `401`,
`403`, or no HTTP status at all i.e. a network/timeout error) — a 400-level
per-item validation failure (bad category, missing GTIN) never does, since
that's a product-data problem, not evidence the connection is broken. At
`config.channels.circuitBreakerThreshold` (default 10) consecutive counted
failures, `status` flips to `degraded` and `sync.service.js#syncListing`
skips further syncs for that tenant+platform until an explicit `resume()`
(used by the reconnect/manual-sync flow) or the reconnect flow clears it.

**Deliberate deviation from a literal reading of "pause that platform's
queue":** eBay's Bull queue is shared across every tenant. A literal
`queue.pause()` on breaker-trip would stall every *other* tenant's eBay sync
because of *one* tenant's broken credentials — a worse outage than the one
the breaker exists to prevent. Implemented instead as a per-tenant gate
`sync.service.js` checks before calling the adapter, which gets the same
practical effect (stop hammering a confirmed-broken connection) without the
cross-tenant blast radius.

### Worker consolidation (`workers/channel.worker.js`)

Registers every adapter, then attaches a `sync_listing` processor per
platform's queue at per-platform concurrency (`SYNC_LISTING_CONCURRENCY` —
eBay stays at `1`, its existing concurrency, unchanged). eBay's
`poll_orders`/`poll_inventory` handlers and their repeatable schedules are
wired directly (not part of the generic per-platform loop — no other
platform has an equivalent yet), ported unchanged from the old
`ebay.worker.js`. Handles `SIGTERM`/`SIGINT`: Bull's `Queue#close()` already
stops picking up new jobs and waits for active ones before resolving; the
handler sequences that against closing the Mongo connection, then exits.

`workers/ebay.worker.js` is now a thin delegate:
`startChannelWorker({ platforms: ["ebay"] })` — kept as a separate entry
point purely so the *old* docker-compose (`worker-ebay: node
src/workers/ebay.worker.js`) keeps booting correctly if the code deploy
lands before the compose file change does (see §5).

`workers/platform.worker.js` merges the old `email.worker.js` and
`search.worker.js` into one process — both are low-volume, unrelated job
types that don't need a dedicated container each. Processing logic itself is
unchanged.

## 5. API routes (additive only)

`GET /api/v1/channels` — every registered adapter's manifest merged with
this tenant's connection status, capabilities, health
(`consecutive_failures`, `last_success_at`), and listing counts by
`sync_status`.

`GET /api/v1/channels/:platform/logs` — paginated `ChannelSyncLog`.

`POST /api/v1/channels/:platform/retry/:logId` — re-enqueues the listing
behind a failed/skipped log row (fresh `sync_listing` job, no fencing seq).

`:platform` is validated against the registry; an unknown platform is a
404. Registered in `routes/index.js` behind the same `auth()` middleware the
eBay routes use. `routes/ebay.routes.js` itself is untouched.

## 6. Deploy order

1. **Deploy the code** (this migration). `EbaySettings` keeps working as the
   read/write source for any tenant not yet lazily migrated;
   `ChannelConnection` starts filling in on demand. `worker-ebay` (old
   compose) and `worker-channels` (new compose) both work correctly against
   the *current* production database at this point — nothing here depends
   on the migration script having run.
2. **Run the migration script** (optional but recommended before decommissioning
   `EbaySettings` reads):
   `node scripts/migrateEbaySettingsToChannelConnection.js` (drop `--dry-run`
   once the printed plan looks right). Safe to run repeatedly; safe to run
   while the app is live and taking traffic.
3. **Switch docker-compose**: replace `worker-ebay` with `worker-channels`
   (`node src/workers/channel.worker.js`), merge `worker-email`/
   `worker-search` into `worker-platform`. `worker-stripe` is untouched.
   `workers/ebay.worker.js` keeps working if this step is delayed relative
   to step 1 — it's a fully-functional restricted delegate to
   `channel.worker.js`, not a stub.

## 7. Rollback

- **Step 3 (compose) rollback**: revert `docker-compose.yml` to
  `worker-ebay`/`worker-email`/`worker-search`. `workers/ebay.worker.js`
  (step 1's code) still runs the exact same eBay processing as
  `channel.worker.js` restricted to eBay — no functional loss.
  `workers/email.worker.js`/`search.worker.js` were left in place, untouched,
  specifically so this rollback direction has something to point back at.
- **Step 2 (migration script) rollback**: none needed — it's additive-only
  (`ChannelConnection` rows) and never modifies or deletes `EbaySettings`.
  If a migrated `ChannelConnection` row is ever suspected wrong for a
  tenant, delete just that row; the lazy read-through will re-derive it from
  `EbaySettings` on the next read.
- **Step 1 (code) rollback**: reverting to the pre-migration code is safe as
  long as `EbaySettings` still has accurate data for every tenant that
  connected *before* the rollback point. A tenant who connects/reconnects
  *after* this migration deployed (writing only to `ChannelConnection`) would
  lose that specific update on a full code rollback — for that
  narrow window, re-run the OAuth connect flow once the rollback is live to
  re-populate `EbaySettings`. This is the same category of risk any
  storage-migrating deploy carries; `EbaySettings` is deliberately kept
  fully intact (not deleted, not migration-locked) specifically to keep this
  rollback path open.

## 8. `// NOTE:` decisions

A few ambiguous calls made in favor of the most backward-compatible option,
each with an inline `// NOTE:`/comment at the site:

- `ebay.adapter.js#loadSettings` never returns `null` (unlike the generic
  contract's convention) — an unconfigured eBay tenant keeps getting today's
  exact "credentials not configured" thrown error, not the new generic
  "not connected" skip.
- Circuit breaker trip is a per-tenant gate in `sync.service.js`, not a
  literal Bull `queue.pause()` — see §4.
- `ChannelConnection`'s eBay discriminator is registered as model name
  `ChannelConnectionEbay` (value still `"ebay"`) to avoid colliding with
  `MarketplaceListing`'s own `"ebay"` discriminator in Mongoose's global
  model registry.
- `degraded` (`ChannelConnection.status`, new) maps to legacy
  `connection_status: "error"` in `ebay.settings.service.js#getSettings` —
  the old enum has no equivalent value, and the frontend's `ebaySettings.ts`
  type isn't touched in this run.
- `access_token_ct`/`refresh_token_ct` each pack tokenCipher's
  `{ ciphertext, iv, tag }` triple into one delimited string, rather than
  widening `ChannelConnection`'s schema per-platform.
