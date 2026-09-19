import { useSyncExternalStore } from "react";

// Shared by ThemeToggle (quick light/dark button in the Topbar), UserMenu's
// account panel (Light/Dark picker in the Sidebar) and Settings → Appearance
// (the full three-way picker) — an external store (not a plain per-component
// useState) is what makes changing the theme in one immediately reflect in
// the others, since they all subscribe to the same module-level value instead
// of holding independent copies.
//
// Two levels here: the MODE the user picked (which can be "system") and the
// PREFERENCE that resolves to (only ever light or dark, since that's what the
// <html> class and every consumer's isDark check need). Callers that only care
// about the rendered theme keep reading `preference`/`isDark` as before.
export type ThemePreference = "light" | "dark";
export type ThemeMode = ThemePreference | "system";

const STORAGE_KEY = "ppg-theme";

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function getInitialMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") return saved;
  } catch {
    /* ignore */
  }
  return "system";
}

function resolve(mode: ThemeMode): ThemePreference {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

function applyTheme(pref: ThemePreference) {
  document.documentElement.classList.toggle("dark", pref === "dark");
}

let currentMode = getInitialMode();
let currentPreference = resolve(currentMode);
applyTheme(currentPreference);

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

// While the mode is "system", the OS switching between light and dark has to
// re-resolve the theme live — that's the whole point of the setting, and the
// index.html bootstrap only runs once at load.
const media = window.matchMedia?.("(prefers-color-scheme: dark)");
media?.addEventListener?.("change", () => {
  if (currentMode !== "system") return;
  const next = resolve(currentMode);
  if (next === currentPreference) return;
  currentPreference = next;
  applyTheme(next);
  emit();
});

function setMode(next: ThemeMode) {
  if (next === currentMode) return;
  currentMode = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  const resolved = resolve(next);
  const themeChanged = resolved !== currentPreference;
  currentPreference = resolved;
  if (themeChanged) applyTheme(resolved);
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// One snapshot object per state change, not per call — returning a fresh
// object literal on every getSnapshot() makes useSyncExternalStore loop.
let snapshot = { mode: currentMode, preference: currentPreference };
listeners.add(() => {
  snapshot = { mode: currentMode, preference: currentPreference };
});

function getSnapshot() {
  return snapshot;
}

export function useThemePreference() {
  const { mode, preference } = useSyncExternalStore(subscribe, getSnapshot);
  return {
    mode,
    preference,
    isDark: preference === "dark",
    setMode,
    /** Pick an explicit light/dark theme — leaves "system" behind. */
    setTheme: setMode as (pref: ThemePreference) => void,
  };
}
