// Friendly copy for known Meta `reason` codes; null for unknown ones.
export function knownMetaConnectError(reason: string | null | undefined): string | null {
  switch (reason) {
    case "catalog_not_accessible":
      return "This Meta sign-in can't reach that catalog. Pick another, or grant access to it in Meta Business Suite and reconnect.";
    case "no_pending_connection":
      return "Your Meta sign-in expired before you chose a catalog. Click Connect Meta again.";
    case "access_denied":
      return "Meta access was not granted. Click Connect Meta to try again.";
    case "no_catalog_granted":
      return "Meta didn't give this app access to any catalog. Reconnect Meta and, when asked, select your catalog and allow catalog access.";
    case "state_expired":
      return "The Meta sign-in took too long and expired. Click Connect Meta to start again.";
    default:
      return null;
  }
}

// OAuth callback `reason`; unknown codes are shown raw.
export function metaConnectErrorMessage(reason: string | null | undefined): string {
  return knownMetaConnectError(reason) ?? `Failed to connect Meta${reason ? ` (${reason})` : ""}. Please try again.`;
}

/** Known copy for an API error's `reason`, else the server's own message. */
export function metaApiErrorMessage(error: unknown): string {
  const err = error as (Error & { reason?: string }) | null;
  return knownMetaConnectError(err?.reason) ?? err?.message ?? metaConnectErrorMessage(null);
}

// Days before a dated token's expiry the connect card asks to reconnect.
export const META_TOKEN_RENEW_WARNING_DAYS = 7;
