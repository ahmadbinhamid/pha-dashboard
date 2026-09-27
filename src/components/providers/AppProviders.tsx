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
      // Kept longer than staleTime (which defaults gcTime to the same value) so an unmounted, gone-stale query still has a cache entry to show instantly on remount instead of a full skeleton flash — standard stale-while-revalidate.
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
