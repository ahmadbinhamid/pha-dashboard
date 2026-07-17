
import { startTransition, useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { Icons } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";

type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "ppg-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const systemDark =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && systemDark);
  if (isDark) root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
      const next = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
      startTransition(() => {
        setTheme(next);
      });
      applyTheme(next);
    } catch {}
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = () => applyTheme(theme);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, [theme]);

  const cycle = () => {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    applyTheme(next);
  };

  const label = theme === "system" ? "System" : theme === "light" ? "Light" : "Dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={cycle}
      className={cn("gap-2", className)}
      aria-label="Toggle theme"
      title={`Theme: ${label}`}
    >
      <span className="relative h-4 w-4">
        <Icons.Sun className={cn("absolute inset-0 transition", theme === "dark" ? "opacity-0" : "opacity-100")} />
        <Icons.Moon className={cn("absolute inset-0 transition", theme === "dark" ? "opacity-100" : "opacity-0")} />
      </span>
      <span className="hidden text-xs text-fg/70 sm:inline">{label}</span>
    </Button>
  );
}

