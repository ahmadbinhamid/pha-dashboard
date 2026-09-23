// services/marketplace/channelConnection.service.js
// Shared read access to ChannelConnection, so adapters' loadSettings never touch the model.

const ChannelConnection = require("../../models/ChannelConnection");

/** A tenant's connection row for `platform` (lean), or null. `withTokens` includes the ciphertexts. */
async function findConnection(tenantId, platform, { withTokens = false } = {}) {
  const query = ChannelConnection.findOne({ tenant_id: tenantId, platform });
  if (withTokens) query.select("+access_token_ct +refresh_token_ct");
  return (await query.lean()) || null;
}

module.exports = { findConnection };
