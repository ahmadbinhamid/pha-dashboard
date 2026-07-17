import { startTransition, useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/Button";
import { Sun, Moon } from "lucide-react";

type Theme = "light" | "dark";
const STORAGE_KEY = "ppg-theme";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

function getInitialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  const systemDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return systemDark ? "dark" : "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial = getInitialTheme();
    startTransition(() => setTheme(initial));
    applyTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    applyTheme(next);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={toggle}
      className={cn("h-9 w-9 p-0", className)}
      aria-label="Toggle theme"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="relative h-4 w-4">
        <Sun className={cn("absolute inset-0 transition", theme === "dark" ? "opacity-0" : "opacity-100")} />
        <Moon className={cn("absolute inset-0 transition", theme === "dark" ? "opacity-100" : "opacity-0")} />
      </span>
    </Button>
  );
}
