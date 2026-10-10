// services/marketplace/registerAdapters.js
// Every marketplace adapter; each process calls this once at startup.

const registry = require("./registry");
const ebayAdapter = require("./adapters/ebay.adapter");
const googleAdapter = require("./adapters/google.adapter");
const metaAdapter = require("./adapters/meta.adapter");

function registerAdapters() {
  registry.register(ebayAdapter);
  registry.register(googleAdapter);
  registry.register(metaAdapter);
}

module.exports = { registerAdapters };
