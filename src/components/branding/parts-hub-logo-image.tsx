import { cn } from "@/utils/cn";
import { Image } from "@/components/ui/image";

export const PARTS_HUB_LOGO_PATH = "/branding/parts-hub-australia-logo.png";

type Props = {
  className?: string;
  sizeClass?: string;
  maxWidthClass?: string;
  priority?: boolean;
};

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
      objectFit="contain"
      className={cn("w-auto object-center", sizeClass, maxWidthClass, className)}
    />
  );
}
