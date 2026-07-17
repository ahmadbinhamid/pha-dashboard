import { Outlet } from "react-router-dom";
import { AppShell } from "@/components/shell/AppShell";

export function ErpLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
