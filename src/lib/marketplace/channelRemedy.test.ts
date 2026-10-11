import test from "node:test";
import assert from "node:assert/strict";
import { channelRemedy } from "./channelRemedy.ts";
import type { ChannelConnectionInfo } from "@/types/channel";

const DOMAINS = { label: "Open Custom Domains", href: "/settings/integrations/domains" };

function connection(overrides: Partial<ChannelConnectionInfo> = {}): ChannelConnectionInfo {
  return { status: "disconnected", connected_at: null, last_error: null, status_reason: null, status_message: null, status_action: null, ...overrides };
}

for (const name of ["Google Shopping", "Meta"]) {
  test(`${name}: unavailable notice links to Custom Domains`, () => {
    const remedy = channelRemedy({
      available: false,
      unavailable_reason: `${name} requires a verified storefront domain — add and verify one in Settings › Integrations › Custom Domains before connecting ${name}.`,
      unavailable_action: DOMAINS,
      connection: connection(),
    });
    assert.equal(remedy?.action?.href, "/settings/integrations/domains");
    assert.match(remedy?.message ?? "", /Custom Domains/);
  });
}

test("a flagged connection's remedy wins over unavailable", () => {
  const reconnect = { label: "Reconnect Meta", href: "/settings/integrations/meta" };
  const remedy = channelRemedy({
    available: false,
    unavailable_reason: "x",
    unavailable_action: DOMAINS,
    connection: connection({ status: "error", status_reason: "reauthentication_required", status_message: "Reconnect", status_action: reconnect }),
  });
  assert.deepEqual(remedy?.action, reconnect);
});

test("an available, healthy channel has no remedy", () => {
  assert.equal(channelRemedy({ available: true, unavailable_reason: null, unavailable_action: null, connection: connection() }), null);
});
