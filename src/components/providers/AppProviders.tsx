import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/auth";
import {
  ToastProvider,
  OrgSettingsProvider,
  CartProvider,
} from "@/context";
import { NotificationSocketProvider } from "@/context/socket";
import { TooltipProvider } from "@/components/ui/Tooltip";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      // gcTime defaults to the same 5 minutes as staleTime, so a query with
      // zero observers (e.g. its page got routed away from) was being
      // garbage-collected right around the moment it went stale anyway —
      // the next visit found no cache entry at all and paid for a full
      // loading-skeleton fetch, indistinguishable from a hard refresh. Kept
      // deliberately longer than staleTime so a query that's gone stale
      // while unmounted still has a cache entry to show instantly on
      // remount (a background refetch still happens, just without the
      // skeleton flash) — the standard "stale-while-revalidate" pairing.
      gcTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <OrgSettingsProvider>
          <ToastProvider>
            <NotificationSocketProvider>
              <CartProvider>
                <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
              </CartProvider>
            </NotificationSocketProvider>
          </ToastProvider>
        </OrgSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
