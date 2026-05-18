import Image from "next/image";
import type { StoreTenant } from "@/lib/store/tenant-types";

type Props = {
  tenant: Pick<StoreTenant, "companyName" | "logoUrl">;
  /** Header lockup — taller; footer — compact */
  variant?: "header" | "footer";
  priority?: boolean;
};

export function StoreLogo({ tenant, variant = "header", priority }: Props) {
  const height = variant === "header" ? 72 : 56;
  const width = variant === "header" ? 72 : 56;

  if (tenant.logoUrl) {
    return (
      <>
        <Image
          src={tenant.logoUrl}
          alt={tenant.companyName}
          width={width}
          height={height}
          className={
            variant === "header"
              ? "h-14 w-14 rounded-lg object-contain object-center sm:h-16 sm:w-16"
              : "h-12 w-12 rounded-lg object-contain object-center opacity-95"
          }
          priority={priority}
        />
        <span className="sr-only">{tenant.companyName}</span>
      </>
    );
  }

  return (
    <span className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-xs font-bold leading-none text-accent-fg sm:h-11 sm:w-11 sm:text-sm">
      {tenant.companyName
        .split(/\s+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 3)
        .toUpperCase()}
    </span>
  );
}
