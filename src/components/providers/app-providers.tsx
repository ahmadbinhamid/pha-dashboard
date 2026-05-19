
import { ToastProvider } from "@/context";
import { OrgSettingsProvider } from "@/context";
import { InventoryProvider } from "@/context";
import { OrdersProvider } from "@/context";
import { BundlesProvider } from "@/context";
import { ListingQueueProvider } from "@/context";
import { CounterCartProvider } from "@/context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <OrgSettingsProvider>
      <InventoryProvider>
        <OrdersProvider>
          <BundlesProvider>
            <ListingQueueProvider>
              <CounterCartProvider>
                <ToastProvider>{children}</ToastProvider>
              </CounterCartProvider>
            </ListingQueueProvider>
          </BundlesProvider>
        </OrdersProvider>
      </InventoryProvider>
    </OrgSettingsProvider>
  );
}

