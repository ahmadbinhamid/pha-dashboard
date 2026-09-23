import { useSyncExternalStore } from "react";

// Shared by UserMenu's quick Light/Dark picker and Settings → Appearance's full three-way picker — an external store, not per-component useState, so changing the theme in one reflects immediately in the other.
// Two levels: the MODE picked (can be "system") and the PREFERENCE it resolves to (only ever light/dark, what <html>'s class and isDark need).
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

// While mode is "system", the OS switching light/dark must re-resolve the theme live — the index.html bootstrap only runs once at load.
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

// One snapshot object per state change, not per call — a fresh object literal on every getSnapshot() would make useSyncExternalStore loop.
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
