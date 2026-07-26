import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/auth";
import {
  ToastProvider,
  OrgSettingsProvider,
  CartProvider,
} from "@/context";
import { TooltipProvider } from "@/components/ui/Tooltip";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
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
            <CartProvider>
              <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            </CartProvider>
          </ToastProvider>
        </OrgSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
