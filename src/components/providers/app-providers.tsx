"use client";

import { ToastProvider } from "@/components/toast/toast-provider";
import { OrgSettingsProvider } from "@/components/settings/org-settings-provider";
import { InventoryProvider } from "@/components/inventory/inventory-store";
import { OrdersProvider } from "@/components/orders/orders-store";
import { BundlesProvider } from "@/components/bundles/bundles-store";
import { ListingQueueProvider } from "@/components/listings/listing-queue-store";
import { CounterCartProvider } from "@/components/counter/counter-cart-store";

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

