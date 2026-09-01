// src/queues/ebay.queue.js
//
// Backward-compatible shim over queues/channel.queue.js's "ebay" queue.
// Kept so anything that still imports this module directly (ebay.listing.
// controller.js, older deploys' in-flight code, this repo's own pre-
// existing tests that mock enqueueEbayJob directly) keeps working exactly
// as before — see channel.queue.js's module header for why the underlying
// Bull queue name itself was never allowed to change.
//
// enqueueEbayJob calls channel.queue.js's enqueueChannelJobDirect (the real
// implementation), NOT enqueueChannelJob (the override-checking public
// entry point) — this module registers ITSELF as the "ebay" override below,
// so calling the public one from here would recurse straight back into this
// function.

const { getQueue, enqueueChannelJobDirect, registerEnqueueOverride } = require("./channel.queue");

const ebayQueue = getQueue("ebay");

async function enqueueEbayJob(type, payload, opts = {}) {
  return enqueueChannelJobDirect("ebay", type, payload, opts);
}

module.exports = { ebayQueue, enqueueEbayJob };

// Registered last (module.exports already assigned above) so the override
// always dispatches through the CURRENT value of module.exports.enqueueEbayJob
// — including a test's mock.method() patch applied after this module was
// first required, which replaces that property in place.
registerEnqueueOverride("ebay", (jobName, payload, opts) => module.exports.enqueueEbayJob(jobName, payload, opts));
