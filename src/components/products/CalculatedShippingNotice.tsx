import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Truck } from "lucide-react";
import Link from "@/components/ui/Link";
import { SHIPPING_SETTINGS_QUERY_KEY, getShippingSettings } from "@/lib/api/shipping";
import { cn } from "@/utils/cn";

const SETTINGS_HREF = "/settings/integrations/transdirect";

// Live status for a calculated-shipping product: Transdirect + package.
export function CalculatedShippingNotice({ missingPackage }: { missingPackage: string[] }) {
  // Settings are admin-only; for other roles this just stays generic.
  const { data, isError } = useQuery({ queryKey: SHIPPING_SETTINGS_QUERY_KEY, queryFn: getShippingSettings, retry: false });
  const settings = data?.data;
  const connected = !!settings?.transdirect_configured && !!settings.sender_postcode && !!settings.sender_suburb;
  const needsSetup = !!settings && !connected;
  const ready = connected && missingPackage.length === 0;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl px-4 py-3 text-sm",
        ready ? "bg-tag-success-bg text-tag-success-fg" : needsSetup || missingPackage.length ? "bg-tag-warn-bg text-tag-warn-fg" : "bg-bg-2 text-fg/70",
      )}
    >
      {ready ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : needsSetup || missingPackage.length ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      )}
      <div className="space-y-1">
        {connected && (
          <p>
            Transdirect connected · ships from {settings.sender_suburb} {settings.sender_postcode}. Priced at checkout from the
            customer&apos;s postcode.
          </p>
        )}
        {needsSetup && (
          <p>
            Transdirect isn&apos;t fully set up, so this product can&apos;t be quoted yet.{" "}
            <Link href={SETTINGS_HREF} className="font-medium underline">
              Finish setup
            </Link>
          </p>
        )}
        {(isError || (!settings && !isError)) && <p>Priced at checkout from the customer&apos;s postcode via Transdirect.</p>}
        {missingPackage.length > 0 && <p>Add the package {missingPackage.join(", ")} above; quotes need all four.</p>}
      </div>
    </div>
  );
}
