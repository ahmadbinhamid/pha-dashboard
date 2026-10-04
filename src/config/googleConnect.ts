// Google OAuth / completeConnect `reason` codes; unknown ones show raw.
export function googleConnectErrorMessage(reason: string | null | undefined): string {
  switch (reason) {
    case "registration_pending":
      return "Almost there — Google just registered this connection and needs a few minutes to finish propagating. Wait 5 minutes, then try again.";
    case "registration_conflict":
      return "This app is already connected to a different Google Merchant Center account and can't be connected to two accounts at once. Contact support if you need to switch accounts.";
    case "merchant_not_accessible":
      return "That Google account doesn't have access to this Merchant Center account — double check the ID, or pick a different account from the list.";
    case "no_pending_connection":
      return "Your Google sign-in session expired before you finished choosing an account — click Connect Google Shopping again.";
    default:
      return `Failed to connect Google Merchant Center account${reason ? ` (${reason})` : ""}. Please try again.`;
  }
}
