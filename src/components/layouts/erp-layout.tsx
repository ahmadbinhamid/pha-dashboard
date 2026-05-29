import { Outlet } from "react-router-dom";
import { AppShell } from "@/components/shell/app-shell";

export function ErpLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
