import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FieldDensityProvider } from "@/components/ui/FieldDensity";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/Sheet";
import { ChannelAvatar } from "@/components/channels/ChannelAvatar";
import { ChannelFieldsPanel, channelFieldSections, channelSectionId } from "@/components/channels/ChannelFieldsPanel";
import { SyncBadge } from "@/components/listings/SyncBadge";
import { cn } from "@/utils/cn";
import type { ChannelFieldSources } from "@/hooks/useChannelFieldSources";
import type { ChannelSummary } from "@/types/channel";
import type { MappedCategory } from "@/types/categoryMapping";
import type { ListingProductDefaults, ListingSyncStatus } from "@/types/marketplace";
import type { Product } from "@/types/product";
import type { ChannelFormState } from "@/lib/marketplace/channelForms";

interface ChannelSettingsDrawerProps {
  open: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
  channel: ChannelSummary;
  index: number;
  // null while the product isn't listed on this channel yet.
  status: ListingSyncStatus | null;
  product: Product;
  form: ChannelFormState;
  onChange: (patch: Partial<ChannelFormState>) => void;
  errors: Record<string, string>;
  sources: ChannelFieldSources;
  mappedCategory: MappedCategory | null | undefined;
  productDefaults: ListingProductDefaults;
  supportsPhotos: boolean;
}

// Right-hand drawer for one channel's settings; the page keeps its place.
export function ChannelSettingsDrawer({
  open,
  onCancel,
  onSubmit,
  submitting,
  channel,
  index,
  status,
  ...panelProps
}: ChannelSettingsDrawerProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const sections = useMemo(() => channelFieldSections(channel.fieldSchema ?? []), [channel.fieldSchema]);
  const [active, setActive] = useState(sections[0]?.key);

  // Scroll-spy: highlight the last section whose top scrolled past the body top.
  useEffect(() => {
    const body = bodyRef.current;
    if (!open || !body) return;
    const onScroll = () => {
      const top = body.getBoundingClientRect().top + 40;
      let current = sections[0]?.key;
      for (const s of sections) {
        const el = document.getElementById(channelSectionId(channel.key, s.key));
        if (el && el.getBoundingClientRect().top <= top) current = s.key;
      }
      setActive(current);
    };
    body.addEventListener("scroll", onScroll);
    return () => body.removeEventListener("scroll", onScroll);
  }, [open, channel.key, sections]);

  function jumpTo(key: string) {
    setActive(key);
    document.getElementById(channelSectionId(channel.key, key))?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onCancel()}>
      <SheetContent className="max-w-none bg-card sm:w-17/20">
        <div className="flex items-center gap-3 border-b border-border py-3 pl-5 pr-12">
          <ChannelAvatar name={channel.name} index={index} channelKey={channel.key} size="md" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="text-sm font-semibold text-fg">{channel.name} listing</SheetTitle>
            <SheetDescription className="text-xs text-fg/55">
              Only what {channel.name} needs beyond the product. Empty fields use the product&apos;s values.
            </SheetDescription>
          </div>
          {status && <SyncBadge status={status} />}
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {/* Chips on phones, a vertical rail once there's room beside the form. */}
          <nav
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-5 py-2 md:w-44 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:px-3 md:py-4"
            aria-label="Sections"
          >
            {sections.map((s) => (
              <Button
                key={s.key}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => jumpTo(s.key)}
                className={cn(
                  "h-7 shrink-0 justify-start rounded-md px-2.5 text-xs font-medium",
                  active === s.key ? "bg-accent/15 text-accent" : "text-fg/60",
                )}
              >
                {s.label}
              </Button>
            ))}
          </nav>

          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
            <FieldDensityProvider density="compact">
              <ChannelFieldsPanel channel={channel} {...panelProps} />
            </FieldDensityProvider>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          <p className="flex-1 text-xs text-fg/55">Changes here only affect {channel.name}.</p>
          <Button type="button" variant="secondary" size="sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" variant="primary" size="sm" onClick={onSubmit} disabled={submitting}>
            {submitting ? "Saving…" : status ? `Save & sync ${channel.name}` : `List on ${channel.name}`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
