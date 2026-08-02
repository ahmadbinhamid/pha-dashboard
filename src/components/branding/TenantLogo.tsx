import { cn } from "@/utils/cn";
import { Image } from "@/components/ui/Image";

// Replaces the old hardcoded PartsHubLogoImage — every tenant has their own
// logo_url (Settings → Business Info → Branding), so nothing here may assume
// a specific tenant's asset. Falls back to an initial-letter badge when a
// tenant hasn't uploaded a logo yet, rather than showing another tenant's mark.
export function TenantLogo({
  logoUrl,
  name,
  className,
  sizeClass = "h-12",
  maxWidthClass = "max-w-[220px]",
  priority,
}: {
  logoUrl?: string | null;
  name?: string | null;
  className?: string;
  sizeClass?: string;
  maxWidthClass?: string;
  priority?: boolean;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={name || "Business logo"}
        width={1024}
        height={1024}
        priority={priority}
        objectFit="contain"
        className={cn("w-auto object-center", sizeClass, maxWidthClass, className)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={name || "Business logo"}
      className={cn(
        "flex aspect-square items-center justify-center rounded-xs bg-accent/15 font-semibold text-accent",
        sizeClass,
        maxWidthClass,
        className,
      )}
    >
      {name?.trim()?.[0]?.toUpperCase() || "?"}
    </div>
  );
}
