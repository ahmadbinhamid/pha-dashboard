// services/google/google.datasource.service.test.js
//
// Coverage for the GCP_NOT_REGISTERED auto-recovery added to
// createDataSource: Google requires a one-time developerRegistration.
// registerGcp call before a fresh GCP project's Merchant API calls are
// trusted by any Merchant Center account — found live (see this file's own
// module comment) as a real 401 on a brand-new project's first connect.
//
// No Mongo/Redis needed — pure fetch stubbing.
//
// Run with: node --test src/services/google/google.datasource.service.test.js

const test = require("node:test");
const { mock } = require("node:test");
const assert = require("node:assert/strict");
const datasourceService = require("./google.datasource.service");

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

const GCP_NOT_REGISTERED_BODY = {
  error: {
    code: 401,
    status: "UNAUTHENTICATED",
    details: [{ metadata: { REASON: "GCP_NOT_REGISTERED" } }],
  },
};

const ALREADY_REGISTERED_BODY = {
  error: { code: 409, status: "ABORTED", message: "ALREADY_REGISTERED: ..." },
};

test("createDataSource: on GCP_NOT_REGISTERED, registers the GCP project and throws a distinct 'pending' error — does NOT retry create synchronously", async (t) => {
  // Registration itself is real, but Google's own error message says
  // propagation can take up to 5 minutes ("try calling the API again in 5
  // minutes") — found live, an immediate retry (fired ~300ms after a
  // successful registerGcp call) failed with the exact same
  // GCP_NOT_REGISTERED error. So createDataSource must register and then
  // surface a clear "try again shortly" error, never attempt a same-request
  // retry that's essentially guaranteed to fail on the very first
  // registration.
  const calls = [];
  mock.method(global, "fetch", async (url) => {
    calls.push(String(url));
    if (String(url).includes("developerRegistration:registerGcp")) return jsonResponse(200, { name: "developerRegistration" });
    return jsonResponse(401, GCP_NOT_REGISTERED_BODY);
  });
  t.after(() => mock.restoreAll());

  await assert.rejects(
    () =>
      datasourceService.createDataSource("tok", {
        merchantId: "123",
        feedLabel: "AU",
        contentLanguage: "en",
        displayName: "Auto Parts Pro — AU",
      }),
    (err) => {
      assert.equal(err.code, "GCP_REGISTRATION_PENDING");
      assert.equal(err.status, 503);
      assert.match(err.message, /5 minutes/);
      return true;
    },
  );

  const dataSourceCalls = calls.filter((c) => c.includes("dataSources") && !c.includes("developerRegistration"));
  assert.equal(dataSourceCalls.length, 1, "must call create exactly once — no synchronous retry");
  assert.ok(calls.some((c) => c.includes("developerRegistration:registerGcp")), "must call registerGcp");
});

test("createDataSource: a GCP project already registered to a DIFFERENT merchant surfaces a clear, actionable error (not the raw Google 409)", async (t) => {
  mock.method(global, "fetch", async (url) => {
    if (String(url).includes("developerRegistration:registerGcp")) return jsonResponse(409, ALREADY_REGISTERED_BODY);
    return jsonResponse(401, GCP_NOT_REGISTERED_BODY);
  });
  t.after(() => mock.restoreAll());

  await assert.rejects(
    () =>
      datasourceService.createDataSource("tok", {
        merchantId: "999",
        feedLabel: "AU",
        contentLanguage: "en",
        displayName: "Auto Parts Pro — AU",
      }),
    (err) => {
      assert.equal(err.code, "GCP_REGISTRATION_CONFLICT");
      assert.equal(err.status, 409);
      assert.match(err.message, /already registered with a DIFFERENT Merchant Center account/);
      return true;
    },
  );
});

test("createDataSource: an ordinary 401 (not GCP_NOT_REGISTERED) is never treated as a registration issue — no registerGcp call, throws as-is", async (t) => {
  let registerCalled = false;
  mock.method(global, "fetch", async (url) => {
    if (String(url).includes("developerRegistration:registerGcp")) {
      registerCalled = true;
      return jsonResponse(200, { name: "developerRegistration" });
    }
    return jsonResponse(401, { error: { code: 401, status: "UNAUTHENTICATED", message: "invalid credentials" } });
  });
  t.after(() => mock.restoreAll());

  await assert.rejects(
    () =>
      datasourceService.createDataSource("tok", {
        merchantId: "123",
        feedLabel: "AU",
        contentLanguage: "en",
        displayName: "Auto Parts Pro — AU",
      }),
    /401/,
  );
  assert.equal(registerCalled, false, "must never call registerGcp for an unrelated 401");
});

test("createDataSource: a 409 (data source already exists) still returns null without touching registerGcp at all", async (t) => {
  let fetchCalls = 0;
  mock.method(global, "fetch", async () => {
    fetchCalls++;
    return jsonResponse(409, {});
  });
  t.after(() => mock.restoreAll());

  const result = await datasourceService.createDataSource("tok", {
    merchantId: "123",
    feedLabel: "AU",
    contentLanguage: "en",
    displayName: "Auto Parts Pro — AU",
  });
  assert.equal(result, null);
  assert.equal(fetchCalls, 1);
});
