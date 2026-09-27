import { createContext, useContext } from "react";

export type FieldDensity = "default" | "compact";

const FieldDensityContext = createContext<FieldDensity>("default");

// Dense surfaces (drawers, side panels) shrink every field control inside.
export function FieldDensityProvider({ density, children }: { density: FieldDensity; children: React.ReactNode }) {
  return <FieldDensityContext.Provider value={density}>{children}</FieldDensityContext.Provider>;
}

export function useFieldDensity() {
  return useContext(FieldDensityContext);
}
