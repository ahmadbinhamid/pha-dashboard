import { Wrench } from "lucide-react";
import { cn } from "@/utils/cn";

export const APP_NAME = "Auto Parts Pro";

// Product-level mark (distinct from any tenant's own logo — see TenantLogo)
// used only where no tenant is known yet, i.e. the pre-login screen and the
// browser tab. Icon-based rather than a static image asset so it never has
// to be swapped when the platform gets real brand artwork.
export function AppLogoMark({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  return (
    <div className={cn("flex items-center justify-center rounded-2xl bg-accent text-accent-fg", className)}>
      <Wrench className={cn("h-8 w-8", iconClassName)} />
    </div>
  );
}
