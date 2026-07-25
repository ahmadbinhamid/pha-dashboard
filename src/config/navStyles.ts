import { cn } from "@/utils/cn";

export function erpNavRowClass(active: boolean, collapsed: boolean) {
  return cn(
    "group flex items-center gap-2.5 rounded-md py-[7px] text-[13px] font-medium tracking-tight transition-colors duration-150",
    collapsed ? "justify-center px-0" : "px-2.5",
    active ? "bg-accent/10 text-accent" : "text-fg/70 hover:bg-muted/60 hover:text-fg",
  );
}

export function erpNavIconClass(active: boolean) {
  return cn(
    "grid h-[18px] w-[18px] shrink-0 place-items-center transition-colors",
    active ? "text-accent" : "text-fg/45 group-hover:text-fg/70",
  );
}
