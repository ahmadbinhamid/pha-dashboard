// services/google/google.environment-invariants.test.js
// Adapted from ebay.environment-invariants.test.js: Google has no sandbox/production URL split,
// but the same class of bug applies — a tenant-scoped credential must never be cached in a
// module-level variable. Statically verifies every token is a function parameter or Map-keyed.
// Run: node --test src/services/google/google.environment-invariants.test.js

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FILES = [
  path.join(__dirname, "google.merchant.api.service.js"),
  path.join(__dirname, "google.datasource.service.js"),
  path.join(__dirname, "google.oauth.service.js"),
];

// Matches only `let`, not `const` — fixed config values like TOKEN_ENDPOINT legitimately have
// token-adjacent names, but a `let` is the shape a mutable single-tenant cache slot would take.
const MODULE_LEVEL_MUTABLE_TOKEN_RE = /^\s*let\s+(_?\w*[Tt]oken\w*)\s*=/gm;

for (const file of FILES) {
  const basename = path.basename(file);

  test(`${basename}: no tenant-scoped access token is cached in a bare module-level variable`, () => {
    const source = fs.readFileSync(file, "utf8");

    const offenders = [];
    let match;
    const re = new RegExp(MODULE_LEVEL_MUTABLE_TOKEN_RE.source, "gm");
    while ((match = re.exec(source))) {
      offenders.push(match[1]);
    }

    assert.deepEqual(
      offenders,
      [],
      "\n\nRULE: a tenant-scoped access token must always be threaded through as a function parameter " +
        "(see getValidAccessToken/insertProductInput/etc.'s own `token` parameter) or kept in a structure " +
        "explicitly keyed by tenant id (a Map, e.g. google.oauth.service.js's own _refreshInFlight) — never " +
        "a bare mutable module-level variable. A bare slot leaks one tenant's credential into every other " +
        "tenant's API calls the moment two tenants' jobs interleave.\n\n" +
        `Offending declaration(s) in ${basename}: ${offenders.join(", ")}`,
    );
  });
}

test("google.oauth.service.js: the in-flight refresh de-dup cache is a Map keyed by tenant id, not a bare shared promise", () => {
  const source = fs.readFileSync(path.join(__dirname, "google.oauth.service.js"), "utf8");
  assert.match(
    source,
    /_refreshInFlight\s*=\s*new Map\(\)/,
    "the in-flight refresh cache must be a Map keyed by tenant id — a bare shared promise would have the " +
      "exact same cross-tenant-leak shape as a bare cached token",
  );
});
