// services/search/typesense.client.js
//
// Lazy singleton client, same pattern as the Stripe/eBay service files (no
// dedicated loaders/typesense.js — there isn't one for Stripe/eBay either).

const Typesense = require("typesense");
const config = require("../../config");

let client = null;

function getTypesenseClient() {
  if (!client) {
    client = new Typesense.Client({
      nodes: [
        {
          host: config.typesense.host,
          port: config.typesense.port,
          protocol: config.typesense.protocol,
        },
      ],
      apiKey: config.typesense.apiKey,
      connectionTimeoutSeconds: config.typesense.connectionTimeoutSeconds,
    });
  }
  return client;
}

module.exports = { getTypesenseClient };
