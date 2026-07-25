import { useEffect, useState } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  /** Always shown — no toggle offered, and toggling it is a no-op. */
  alwaysVisible?: boolean;
}

function readStored(tableKey: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(`col_vis_${tableKey}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Persists which optional columns are shown for a given table, per browser —
// e.g. useColumnVisibility("orders", ORDER_COLUMNS).
export function useColumnVisibility(tableKey: string, columns: ColumnDef[]) {
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => readStored(tableKey));

  useEffect(() => {
    try {
      localStorage.setItem(`col_vis_${tableKey}`, JSON.stringify(visibility));
    } catch {
      /* localStorage unavailable — visibility still works for this session */
    }
  }, [tableKey, visibility]);

  function toggleColumn(key: string) {
    const col = columns.find((c) => c.key === key);
    if (col?.alwaysVisible) return;
    setVisibility((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  }

  function isVisible(key: string) {
    const col = columns.find((c) => c.key === key);
    if (col?.alwaysVisible) return true;
    return visibility[key] !== false;
  }

  return { visibility, toggleColumn, isVisible };
}
