import { cn } from "@/utils/cn";
import { Image } from "@/components/ui/Image";

// Every tenant has its own logo_url (Settings → Business Info → Branding); falls back to an initial-letter badge when none is uploaded.
export function TenantLogo({
  logoUrl,
  name,
  className,
  sizeClass = "h-12",
  maxWidthClass = "max-w-[220px]",
  priority,
  // "contain" (default): full logo, no cropping. "cover": fills the box edge-to-edge, needed for compact square/rounded badge slots (Sidebar) so a non-square logo's corners don't show inside the rounded ring.
  objectFit = "contain",
}: {
  logoUrl?: string | null;
  name?: string | null;
  className?: string;
  sizeClass?: string;
  maxWidthClass?: string;
  priority?: boolean;
  objectFit?: "contain" | "cover";
}) {
  if (logoUrl) {
    if (objectFit === "cover") {
      // fill mode: ancestor (Sidebar/MobileSidebar's badge wrapper) must be `relative` with an explicit square size to crop correctly.
      return <Image src={logoUrl} alt={name || "Business logo"} priority={priority} fill objectFit="cover" className={className} />;
    }
    return (
      <Image
        src={logoUrl}
        alt={name || "Business logo"}
        width={1024}
        height={1024}
        priority={priority}
        objectFit={objectFit}
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
