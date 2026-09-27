// services/marketplace/registerAdapters.js
// Single place listing all marketplace adapters; every process calls this once at startup.

const registry = require("./registry");
const ebayAdapter = require("./adapters/ebay.adapter");
const googleAdapter = require("./adapters/google.adapter");

function registerAdapters() {
  registry.register(ebayAdapter);
  registry.register(googleAdapter);
}

module.exports = { registerAdapters };
