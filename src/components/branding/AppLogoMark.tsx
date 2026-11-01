import { cn } from "@/utils/cn";

export const APP_NAME = "Parts Manager";

// Pre-login product mark; the wordmark stays text so it follows the theme.
export function AppLogoMark({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-10 items-center gap-2.5", className)}>
      <img src="/branding/logo-mark.png" alt="" className="h-full w-auto shrink-0" />
      <span className="text-[1.85rem] font-extrabold leading-none tracking-tight text-fg">
        Parts<span className="text-accent">Manager</span>
      </span>
    </div>
  );
}
