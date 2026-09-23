// services/marketplace/channelConnection.service.js
// Shared ChannelConnection reads, so adapters never touch the model.

const ChannelConnection = require("../../models/ChannelConnection");

/** Lean connection row for a platform, or null; `withTokens` adds ciphertexts. */
async function findConnection(tenantId, platform, { withTokens = false } = {}) {
  const query = ChannelConnection.findOne({ tenant_id: tenantId, platform });
  if (withTokens) query.select("+access_token_ct +refresh_token_ct");
  return (await query.lean()) || null;
}

module.exports = { findConnection };
