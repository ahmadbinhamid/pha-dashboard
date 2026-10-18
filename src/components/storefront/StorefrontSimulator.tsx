import { useRef } from "react";
import { SimulatedStorefront } from "@/components/storefront/SimulatedStorefront";
import { SIMULATOR_DEVICES } from "@/config/storefront";
import { useElementSize } from "@/hooks/useElementSize";
import type { Category, Product } from "@/types/product";
import type { SimulatorDevice, StorefrontPreviewContent } from "@/types/storefront";
import { cn } from "@/utils/cn";

// Phone bezel width (border-8) on each side, added to the 390px viewport.
const PHONE_BEZEL = 16;

interface StorefrontSimulatorProps {
  device: SimulatorDevice;
  content: StorefrontPreviewContent;
  storeName: string;
  logoUrl: string | null;
  host: string;
  categories: Category[];
  products: Product[];
  className?: string;
}

// Renders at the device's real size, scaled down to fit both box dimensions.
export function StorefrontSimulator({ device, className, ...storefront }: StorefrontSimulatorProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(frameRef);

  const spec = SIMULATOR_DEVICES.find((d) => d.value === device) ?? SIMULATOR_DEVICES[0];
  const isPhone = device === "mobile";
  const outerWidth = spec.width + (isPhone ? PHONE_BEZEL : 0);
  const outerHeight = spec.height + (isPhone ? PHONE_BEZEL : 0);
  const scale = width && height ? Math.min(1, width / outerWidth, height / outerHeight) : 0;

  return (
    <div ref={frameRef} className={cn("relative min-h-0 overflow-hidden", className)}>
      <div
        style={{
          width: outerWidth,
          height: outerHeight,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
        className={cn(
          "absolute top-1/2 left-1/2 overflow-hidden bg-bg",
          isPhone ? "rounded-[2.5rem] border-8 border-luxury-ink shadow-card" : "rounded-xl border border-border shadow-card",
        )}
      >
        {isPhone ? <div className="absolute top-0 left-1/2 z-20 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-luxury-ink" /> : null}
        <SimulatedStorefront key={device} mobile={isPhone} {...storefront} />
      </div>
    </div>
  );
}
