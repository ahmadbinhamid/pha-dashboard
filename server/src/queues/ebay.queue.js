// src/queues/ebay.queue.js
// Backward-compatible shim over channel.queue.js's "ebay" queue, kept so anything still
// importing this module directly keeps working, since the underlying Bull queue name was
// never allowed to change.
// `ebayQueue` is a getter, not an eager call, since requiring this file used to open a real,
// never-closed Redis socket immediately — found live, was hanging the test suite.
// enqueueEbayJob calls enqueueChannelJobDirect, not enqueueChannelJob, since this module
// registers itself as eBay's override and calling the public one would recurse into itself.

const { getQueue, enqueueChannelJobDirect, registerEnqueueOverride } = require("./channel.queue");

async function enqueueEbayJob(type, payload, opts = {}) {
  return enqueueChannelJobDirect("ebay", type, payload, opts);
}

module.exports = {
  get ebayQueue() {
    return getQueue("ebay");
  },
  enqueueEbayJob,
};

// Registered last so the override always dispatches through the current value of
// module.exports.enqueueEbayJob, including a test's mock.method() patch applied afterward.
registerEnqueueOverride("ebay", (jobName, payload, opts) => module.exports.enqueueEbayJob(jobName, payload, opts));
