import type { ComponentType } from "react";
import type { ChannelConnectionStatus, ChannelSummary } from "@/types/channel";

export type ChannelBadgeVariant = "ok" | "warn" | "danger" | "muted";

export interface ChannelStatusDisplay {
  variant: ChannelBadgeVariant;
  label: string;
}

// Platform-specific connect inputs, e.g. eBay's sandbox flag.
export type ChannelConnectOptions = Record<string, boolean>;

export interface ChannelConnectOptionsProps {
  value: ChannelConnectOptions;
  onChange: (value: ChannelConnectOptions) => void;
}

// What an inline setup step (e.g. Google's account picker) receives.
export interface ChannelInlineStepProps {
  channel: ChannelSummary;
  // Ends the multi-step callback and shows `message` as a success banner.
  onComplete: (message: string) => void;
}

export interface ChannelSectionProps {
  // Undefined while /channels loads; sections must not wait on it.
  channel?: ChannelSummary;
}

// Per-platform pieces; every field is optional except how to start OAuth.
export interface ChannelConnectPlugin {
  getConnectUrl: (options: ChannelConnectOptions) => Promise<string>;
  description?: string;
  // Noun on the button: "Connect <connectNoun>" / "Reconnect <connectNoun>".
  connectNoun?: string;
  connectErrorText?: string;
  connectedText?: string;
  disconnectedText?: string;
  // Query-string key the OAuth callback lands with; default "<key>_connect".
  callbackParam?: string;
  callbackSuccessText?: string;
  callbackErrorText?: (reason: string | null) => string;
  // Callback values that mark an unfinished step and must stay in the URL.
  inlineStepValue?: string;
  invalidateQueryKeys?: readonly (readonly string[])[];
  statusOverrides?: Partial<Record<ChannelConnectionStatus, ChannelStatusDisplay>>;
  ConnectOptions?: ComponentType<ChannelConnectOptionsProps>;
  // Replaces connectedText where the status needs a live check.
  ConnectedText?: ComponentType;
  InlineStep?: ComponentType<ChannelInlineStepProps>;
  // Rendered below the card, e.g. eBay's settings form.
  Section?: ComponentType<ChannelSectionProps>;
}
