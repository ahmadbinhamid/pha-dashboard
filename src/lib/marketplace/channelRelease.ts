import type { ChannelSummary } from "@/types/channel";

// Shown, but not connectable yet; flipping the server manifest launches it.
export const isChannelComingSoon = (channel: Pick<ChannelSummary, "status"> | undefined) => channel?.status === "coming_soon";

export const comingSoonText = (name: string) => `${name} is coming soon. You'll be able to connect it here once it launches.`;
