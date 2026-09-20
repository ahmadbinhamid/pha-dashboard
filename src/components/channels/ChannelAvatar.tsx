// Identity-only chip for a sales channel — initials on a categorical color,
// cycled by index. Same principle as ActiveChannelsCard.tsx's own inline
// avatar (dashboard): identity gets a categorical color, health gets a
// separate semantic-token dot/badge, and the two never share one element.
// Kept as its own component rather than reusing that one directly — its
// tinted rounded-xl treatment is dashboard-specific styling, not something
// to force onto the Products page (or vice-versa).
//
// Deliberately carries no status meaning. Mixing "which channel" and "is it
// healthy" into one colored dot was exactly what made the Products page's
// channel status confusing: the same visual meant one thing collapsed and a
// different thing once expanded. This chip only ever answers "which
// channel"; color here never implies health.
const AVATAR_COLOR_VARS = [
  "var(--color-cat-1)",
  "var(--color-cat-2)",
  "var(--color-cat-3)",
  "var(--color-cat-4)",
  "var(--color-cat-5)",
  "var(--color-cat-6)",
];

export function channelAvatarColor(index: number) {
  return AVATAR_COLOR_VARS[index % AVATAR_COLOR_VARS.length];
}

export function channelInitials(name: string) {
  const words = name.trim().split(/\s+/);
  return words.length === 1 ? words[0].slice(0, 2).toUpperCase() : (words[0][0] + words[1][0]).toUpperCase();
}

export function ChannelAvatar({
  name,
  index,
  size = "sm",
}: {
  name: string;
  /** Position among the channels being shown together — picks the color. */
  index: number;
  size?: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-5 w-5 text-[9px]" : "h-8 w-8 text-xs";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${dimension}`}
      style={{ backgroundColor: channelAvatarColor(index) }}
      aria-hidden="true"
    >
      {channelInitials(name)}
    </span>
  );
}
