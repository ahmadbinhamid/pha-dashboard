"use client";

import Image from "next/image";
import { cn } from "@/lib/cn";

export const PARTS_HUB_LOGO_PATH = "/branding/parts-hub-australia-logo.png";

type Props = {
  className?: string;
  /** Tailwind height cap, e.g. h-9, h-10, h-14 */
  sizeClass?: string;
  maxWidthClass?: string;
  priority?: boolean;
};

/** Parts Hub Australia lockup — dashboard shell, mobile nav, login. */
export function PartsHubLogoImage({
  className,
  sizeClass = "h-12",
  maxWidthClass = "max-w-[220px]",
  priority,
}: Props) {
  return (
    <Image
      src={PARTS_HUB_LOGO_PATH}
      alt="Parts Hub Australia"
      width={1024}
      height={1024}
      priority={priority}
      className={cn("w-auto object-contain object-center", sizeClass, maxWidthClass, className)}
    />
  );
}
