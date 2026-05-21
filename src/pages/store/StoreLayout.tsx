import { Outlet } from "react-router-dom";
import { StoreHeader } from "@/components/store/store-header";
import { StoreFooter } from "@/components/store/store-footer";
import { DEFAULT_STORE_TENANT } from "@/lib/store/tenant";

export default function StoreLayout() {
  const tenant = DEFAULT_STORE_TENANT;
  return (
    <div className="store-luxury flex min-h-dvh w-full min-w-0 flex-col overflow-x-clip bg-bg text-fg">
      <StoreHeader tenant={tenant} />
      <main className="flex-1">
        <Outlet />
      </main>
      <StoreFooter tenant={tenant} />
    </div>
  );
}
