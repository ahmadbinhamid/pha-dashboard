import { AppLogoMark } from "@/components/branding/AppLogoMark";
import { Card } from "@/components/ui/Card";

// Centred logo + card frame shared by the password pages.
export function AuthCardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4">
      <div className="w-full max-w-105">
        <div className="mb-6 flex flex-col items-center justify-center gap-2">
          {/* The lockup spells out the app name, so no separate label. */}
          <AppLogoMark className="h-12" />
          <div className="text-xs text-fg/60">Inventory &amp; Listings</div>
        </div>
        <Card className="overflow-hidden bg-bg/80 backdrop-blur supports-backdrop-filter:bg-bg/65">{children}</Card>
      </div>
    </div>
  );
}
