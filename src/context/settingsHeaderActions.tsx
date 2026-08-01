import { createContext, useContext } from "react";
import { createPortal } from "react-dom";

// Lets a nested /settings/* page (e.g. the "Save Changes" button on Business
// Info) render into SettingsLayout's sticky header bar instead of its own
// scrollable content — so the action stays visible while the page scrolls.
const SettingsHeaderActionsContext = createContext<HTMLElement | null>(null);

export const SettingsHeaderActionsProvider = SettingsHeaderActionsContext.Provider;

export function SettingsHeaderActions({ children }: { children: React.ReactNode }) {
  const target = useContext(SettingsHeaderActionsContext);
  if (!target) return null;
  return createPortal(children, target);
}
