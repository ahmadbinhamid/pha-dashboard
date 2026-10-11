import { useQuery } from "@tanstack/react-query";
import { getChannels } from "@/lib/api/channels";
import { META_TOKEN_RENEW_WARNING_DAYS } from "@/config/metaConnect";
import { InlineNotice } from "@/components/ui/InlineNotice";

const DAY_MS = 24 * 60 * 60 * 1000;

// Connected Meta status; warns before a dated token lapses.
export function MetaConnectedStatusText() {
  const { data } = useQuery({ queryKey: ["channels"], queryFn: getChannels });
  const expiresAt = data?.data.find((c) => c.key === "meta")?.connection.token_expires_at;
  const daysLeft = expiresAt ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS) : null;

  if (daysLeft !== null && daysLeft <= META_TOKEN_RENEW_WARNING_DAYS) {
    return (
      <InlineNotice variant="warn">
        Meta access expires in {Math.max(daysLeft, 0)} day{daysLeft === 1 ? "" : "s"}. Reconnect Meta to keep syncing.
      </InlineNotice>
    );
  }
  return <p className="text-sm text-fg/65">This store is connected to Meta and syncing listings to Facebook and Instagram Shops.</p>;
}
