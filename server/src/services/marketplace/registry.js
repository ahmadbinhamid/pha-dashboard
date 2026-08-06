// services/marketplace/registry.js
//
// Adapter registry. Each platform registers itself at startup; the sync
// dispatcher resolves the right adapter by listing.platform at runtime.

const adapters = new Map();

function register(adapter) {
  if (!adapter.key) throw new Error("Marketplace adapter must have a key property");
  adapters.set(adapter.key, adapter);
}

function getAdapter(platform) {
  const adapter = adapters.get(platform);
  if (!adapter) throw new Error(`No marketplace adapter registered for: ${platform}`);
  return adapter;
}

module.exports = { register, getAdapter };
