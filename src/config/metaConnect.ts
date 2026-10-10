// Meta OAuth / completeConnect `reason` codes; unknown ones show raw.
export function metaConnectErrorMessage(reason: string | null | undefined): string {
  switch (reason) {
    case "catalog_not_accessible":
      return "This Meta sign-in can't reach that catalog. Pick another, or grant access to it in Meta Business Suite and reconnect.";
    case "no_pending_connection":
      return "Your Meta sign-in expired before you chose a catalog. Click Connect Meta again.";
    case "access_denied":
      return "Meta access was not granted. Click Connect Meta to try again.";
    default:
      return `Failed to connect Meta${reason ? ` (${reason})` : ""}. Please try again.`;
  }
}

// Days before a dated token's expiry the connect card asks to reconnect.
export const META_TOKEN_RENEW_WARNING_DAYS = 7;
