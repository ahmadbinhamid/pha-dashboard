import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { LogoUploadField } from "@/components/tenant-settings/LogoUploadField";
import { SettingsSection } from "@/components/settings/SettingsSection";
import {
  DarkPreview,
  LightPreview,
  SystemPreview,
  ThemeModeCard,
} from "@/components/settings/ThemeModeCard";
import { useThemePreference } from "@/hooks";
import { useToast } from "@/context";
import { updateTenantSettings } from "@/lib/api/tenantSettings";
import type { TenantSettings } from "@/types/tenantSettings";

// Brand fields live in their own small form rather than the page-wide company
// profile one, so this card's Save only ever PATCHes what it shows — the
// tenant-settings endpoint takes partial bodies (every key optional), which is
// what lets each settings card own its save instead of one giant submit.
type BrandState = {
  logo_url: string | null;
  favicon_url: string | null;
  brand_colour: string;
  accent_colour: string;
};

function toBrandState(settings: TenantSettings): BrandState {
  return {
    logo_url: settings.logo_url,
    favicon_url: settings.favicon_url,
    brand_colour: settings.brand_colour ?? "#000000",
    accent_colour: settings.accent_colour ?? "#FFFFFF",
  };
}

export function AppearanceTab({ settings, loading }: { settings?: TenantSettings; loading?: boolean }) {
  const { mode, setMode } = useThemePreference();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [brand, setBrand] = useState<BrandState | null>(settings ? toBrandState(settings) : null);

  useEffect(() => {
    if (settings) setBrand(toBrandState(settings));
  }, [settings]);

  const mutation = useMutation({
    mutationFn: updateTenantSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      toast({ title: "Branding saved", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't save branding", description: err.message, tone: "danger" }),
  });

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Interface Theme"
        description="How the dashboard looks on this device. Stored per browser, not per account — each device can differ."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ThemeModeCard
            mode="light"
            label="Light Mode"
            description="Crisp, high-contrast light layout"
            icon={<Sun className="h-4 w-4 text-warn" />}
            preview={<LightPreview />}
            selected={mode === "light"}
            onSelect={setMode}
          />
          <ThemeModeCard
            mode="dark"
            label="Dark Mode"
            description="Deep neutral palette, easy on the eyes"
            icon={<Moon className="h-4 w-4 text-accent" />}
            preview={<DarkPreview />}
            selected={mode === "dark"}
            onSelect={setMode}
          />
          <ThemeModeCard
            mode="system"
            label="System Default"
            description="Follows your operating system"
            icon={<Monitor className="h-4 w-4 text-fg/60" />}
            preview={<SystemPreview />}
            selected={mode === "system"}
            onSelect={setMode}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="Brand Identity"
        description="Your logo, used across invoices, the storefront header and customer emails."
        footer={
          <>
            <Button variant="ghost" disabled={!settings || mutation.isPending} onClick={() => settings && setBrand(toBrandState(settings))}>
              Reset
            </Button>
            <Button
              variant="primary"
              disabled={!brand || mutation.isPending}
              onClick={() => brand && mutation.mutate(brand)}
            >
              {mutation.isPending ? "Saving…" : "Save Branding"}
            </Button>
          </>
        }
      >
        {loading || !brand ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <LogoUploadField
                shape="square"
                title="Store Logo"
                bullets={["Shown on invoices, emails and the storefront header", "PNG or SVG, at least 256×256"]}
                value={brand.logo_url}
                onChange={(url) => setBrand((b) => (b ? { ...b, logo_url: url } : b))}
                onRemove={() => setBrand((b) => (b ? { ...b, logo_url: null } : b))}
              />
              <LogoUploadField
                shape="circle"
                title="Favicon"
                bullets={["Shown in the browser tab", "Square, 64×64 or larger"]}
                value={brand.favicon_url}
                onChange={(url) => setBrand((b) => (b ? { ...b, favicon_url: url } : b))}
                onRemove={() => setBrand((b) => (b ? { ...b, favicon_url: null } : b))}
              />
            </div>
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
