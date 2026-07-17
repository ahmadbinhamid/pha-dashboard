import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/auth";
import {
  ToastProvider,
  OrgSettingsProvider,
  InventoryProvider,
} from "@/context";

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
          <InventoryProvider>
            <ToastProvider>{children}</ToastProvider>
          </InventoryProvider>
        </OrgSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
