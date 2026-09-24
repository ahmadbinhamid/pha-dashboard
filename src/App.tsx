import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProviders } from "@/components/providers/AppProviders";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GuestRoute } from "@/components/auth/GuestRoute";
import { ErpLayout } from "@/components/layouts/ErpLayout";
import { useAuth } from "@/context/auth";

// Auth pages
import LoginPage from "@/pages/LoginPage";
// Only imported by the commented-out /register route below.
// import RegisterPage from "@/pages/RegisterPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";

// ERP pages
import DashboardPage from "@/pages/erp/DashboardPage";
import ProductsPage from "@/pages/erp/ProductsPage";
import ProductCreatePage from "@/pages/erp/ProductCreatePage";
import ProductEditPage from "@/pages/erp/ProductEditPage";
import ChannelSyncPage from "@/pages/erp/ChannelSyncPage";
import CategoriesPage from "@/pages/erp/CategoriesPage";
import InventoryPage from "@/pages/erp/InventoryPage";
import CustomersPage from "@/pages/erp/CustomersPage";
import CustomerDetailPage from "@/pages/erp/CustomerDetailPage";
import OrdersPage from "@/pages/erp/OrdersPage";
import OrderDetailPage from "@/pages/erp/OrderDetailPage";
import CreateOrderPage from "@/pages/erp/CreateOrderPage";
import PaymentsPage from "@/pages/erp/PaymentsPage";
import ReportsPage from "@/pages/erp/ReportsPage";
import ListingCreatePage from "@/pages/erp/ListingCreatePage";
import ListingEditPage from "@/pages/erp/ListingEditPage";
import ActivityLogPage from "@/pages/erp/ActivityLogPage";
import ProfilePage from "@/pages/erp/ProfilePage";
import SettingsPage from "@/pages/erp/SettingsPage";
import InvitePage from "@/pages/InvitePage";
import PayOrderPage from "@/pages/PayOrderPage";

function HomeRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    );
  }
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppProviders>
        <Routes>
          {/* Public: order id + guest token only; shared by every tenant's pay links. */}
          <Route path="/pay/:orderId" element={<PayOrderPage />} />

          {/* Not behind GuestRoute: signed-in users accept, new users sign up. */}
          <Route path="/invite" element={<InvitePage />} />

          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />

          {/* Self-signup disabled (invite-only); kept for a one-line re-enable.
          <Route
            path="/register"
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />
          */}

          <Route
            path="/auth/forgot-password"
            element={
              <GuestRoute>
                <ForgotPasswordPage />
              </GuestRoute>
            }
          />

          <Route path="/auth/reset-password" element={<ResetPasswordPage />} />

          <Route
            element={
              <ProtectedRoute>
                <ErpLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/products" element={<ProductsPage />} />
            {/* Old /catalogue URL, redirected for existing bookmarks. */}
            <Route path="/catalogue" element={<Navigate to="/products" replace />} />
            <Route path="/products/new" element={<ProductCreatePage />} />
            <Route path="/products/:slug/edit" element={<ProductEditPage />} />
            <Route path="/channel-sync" element={<ChannelSyncPage />} />
            <Route path="/listings" element={<Navigate to="/channel-sync" replace />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/create-order" element={<CreateOrderPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/:id" element={<OrderDetailPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/listings/new" element={<ListingCreatePage />} />
            <Route path="/listings/:id/edit" element={<ListingEditPage />} />
            <Route path="/activity-log" element={<ActivityLogPage />} />
            <Route path="/profile" element={<ProfilePage />} />

            {/* URL-driven settings tabs; pre-redesign URLs redirect to their new tab. */}
            <Route path="/settings" element={<Navigate to="/settings/store" replace />} />
            <Route path="/settings/business-info" element={<Navigate to="/settings/store/general" replace />} />
            <Route path="/settings/payment-account" element={<Navigate to="/settings/integrations/stripe" replace />} />
            <Route path="/settings/payment-settings" element={<Navigate to="/settings/integrations/payment-links" replace />} />
            <Route path="/settings/email" element={<Navigate to="/settings/integrations/email" replace />} />
            <Route path="/settings/ebay" element={<Navigate to="/settings/integrations/ebay" replace />} />
            <Route path="/settings/google" element={<Navigate to="/settings/integrations/google" replace />} />
            <Route path="/settings/domains" element={<Navigate to="/settings/integrations/domains" replace />} />
            <Route path="/settings/:tab" element={<SettingsPage />} />
            <Route path="/settings/:tab/:section" element={<SettingsPage />} />
          </Route>

          <Route path="/" element={<HomeRedirect />} />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
