import { cn } from "@/lib/cn";

/** Shared ERP sidebar / drawer nav item styles. */
export function erpNavRowClass(active: boolean, collapsed: boolean) {
  return cn(
    "group relative flex items-center gap-3 rounded-lg py-2.5 text-[13px] font-medium tracking-tight transition-colors duration-150",
    collapsed ? "mx-0.5 justify-center px-0" : "px-2.5",
    active
      ? "bg-bg-2 text-fg shadow-sm before:pointer-events-none before:absolute before:left-0 before:top-1/2 before:h-7 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[hsl(var(--accent))] before:content-['']"
      : "text-fg/65 hover:bg-bg-2/60 hover:text-fg",
  );
}

export function erpNavIconClass(active: boolean) {
  return cn(
    "grid h-8 w-8 shrink-0 place-items-center rounded-md transition-colors",
    active
      ? "bg-[hsl(var(--accent))]/12 text-[hsl(var(--accent))]"
      : "text-fg/45 group-hover:bg-bg-2 group-hover:text-fg/75",
  );
}
