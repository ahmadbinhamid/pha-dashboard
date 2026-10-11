import type { ChannelStatusAction, ChannelSummary } from "@/types/channel";

export interface ChannelRemedy {
  message: string;
  action: ChannelStatusAction | null;
}

// NOTE: a flagged connection outranks "unavailable"; texts are server-sent.
export function channelRemedy(channel: Pick<ChannelSummary, "available" | "unavailable_reason" | "unavailable_action" | "connection">): ChannelRemedy | null {
  const { status_reason, status_message, status_action } = channel.connection;
  if (status_reason && status_message) return { message: status_message, action: status_action ?? null };
  if (!channel.available && channel.unavailable_reason) {
    return { message: channel.unavailable_reason, action: channel.unavailable_action ?? null };
  }
  return null;
}
