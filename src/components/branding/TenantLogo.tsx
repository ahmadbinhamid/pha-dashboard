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
  // "contain" (default) preserves the full logo without cropping — right
  // for a standalone logo display. "cover" fills the box edge-to-edge —
  // needed for a compact square/rounded badge slot (Sidebar, MobileSidebar):
  // with "contain", a non-square logo gets letterboxed, and its own sharp
  // rectangular corners end up visible floating inside the rounded ring
  // around it, even though that ring is clipping correctly.
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
      // fill mode: fills the nearest positioned ancestor edge-to-edge
      // (that ancestor — Sidebar/MobileSidebar's badge wrapper — must be
      // `relative` with an explicit square size for this to crop into a
      // filled square/circle rather than leaving letterboxed gaps).
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
