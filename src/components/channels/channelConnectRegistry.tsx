import { EbaySandboxSwitch } from "@/components/ebay-settings/EbaySandboxSwitch";
import { EbayConnectedStatusText } from "@/components/ebay-settings/EbayConnectedStatusText";
import { EbaySettingsSection } from "@/components/ebay-settings/EbaySettingsSection";
import { GoogleAccountPicker } from "@/components/google-settings/GoogleAccountPicker";
import { getEbayConnectUrl } from "@/lib/api/ebay";
import { getGoogleConnectUrl } from "@/lib/api/google";
import { googleConnectErrorMessage } from "@/config/googleConnect";
import type { ChannelConnectPlugin } from "@/types/channelConnect";

// Platform pieces the manifest can't express; unlisted platforms use defaults.
export const CHANNEL_CONNECT_PLUGINS: Record<string, ChannelConnectPlugin> = {
  ebay: {
    getConnectUrl: async (options) => (await getEbayConnectUrl(!!options.sandbox)).data.url,
    description: "Connect this store's eBay seller account to publish and sync listings.",
    connectNoun: "eBay account",
    connectErrorText: "Failed to start eBay connection",
    disconnectedText: "No eBay account connected yet — listings can be created locally but won't sync to eBay.",
    callbackSuccessText: "eBay account connected successfully.",
    callbackErrorText: (reason) => `Failed to connect eBay account${reason ? ` (${reason})` : ""}. Please try again.`,
    invalidateQueryKeys: [["ebay-status"], ["ebay-settings"]],
    // NOTE: eBay's card always showed these labels; kept rather than unified.
    statusOverrides: {
      degraded: { variant: "danger", label: "Connection error" },
      pending: { variant: "muted", label: "Not connected" },
    },
    ConnectOptions: EbaySandboxSwitch,
    ConnectedText: EbayConnectedStatusText,
    Section: EbaySettingsSection,
  },
  google: {
    getConnectUrl: async () => (await getGoogleConnectUrl()).data.url,
    description: "Connect this store's Google Merchant Center account to publish and sync listings.",
    connectNoun: "Google Shopping",
    connectErrorText: "Failed to start Google Shopping connection",
    connectedText: "This store is connected to Google Shopping and syncing listings.",
    disconnectedText:
      "No Google Merchant Center account connected yet — listings can be created locally but won't sync to Google Shopping.",
    callbackErrorText: googleConnectErrorMessage,
    inlineStepValue: "choose_account",
    InlineStep: GoogleAccountPicker,
  },
};
