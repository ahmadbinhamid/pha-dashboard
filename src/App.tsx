import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProviders } from "@/components/providers/app-providers";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { GuestRoute } from "@/components/auth/guest-route";
import { ErpLayout } from "@/components/layouts/erp-layout";

// Store layout
import StoreLayout from "@/pages/store/StoreLayout";

// Auth pages
import LoginPage from "@/pages/LoginPage";

// ERP pages
import DashboardPage from "@/pages/erp/DashboardPage";
import InventoryPage from "@/pages/erp/InventoryPage";
import InventorySettingsPage from "@/pages/erp/InventorySettingsPage";
import InventoryNewPage from "@/pages/erp/InventoryNewPage";
import ProductsPage from "@/pages/erp/ProductsPage";
import ProductCreatePage from "@/pages/erp/ProductCreatePage";
import ProductEditPage from "@/pages/erp/ProductEditPage";
import InventoryBundlesPage from "@/pages/erp/InventoryBundlesPage";
import ProductPage from "@/pages/erp/ProductPage";
import OrdersPage from "@/pages/erp/OrdersPage";
import OrdersNewPage from "@/pages/erp/OrdersNewPage";
import CustomersPage from "@/pages/erp/CustomersPage";
import SuppliersPage from "@/pages/erp/SuppliersPage";
import ReportsPage from "@/pages/erp/ReportsPage";
import AnalyticsPage from "@/pages/erp/AnalyticsPage";
import ListingsPage from "@/pages/erp/ListingsPage";
import ListingCreatePage from "@/pages/erp/ListingCreatePage";
import ListingEditPage from "@/pages/erp/ListingEditPage";
import SettingsPage from "@/pages/erp/SettingsPage";
import EbayUploaderPage from "@/pages/erp/EbayUploaderPage";

// Store pages
import StoreHomePage from "@/pages/store/StoreHomePage";
import PartsPage from "@/pages/store/PartsPage";
import ProductPdpPage from "@/pages/store/ProductPdpPage";
import BrandsPage from "@/pages/store/BrandsPage";
import CartPage from "@/pages/store/CartPage";
import ContactPage from "@/pages/store/ContactPage";
import AccountPage from "@/pages/store/AccountPage";
import SearchPage from "@/pages/store/SearchPage";
import AboutPage from "@/pages/store/AboutPage";

export default function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AppProviders>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />

          <Route
            element={
              <ProtectedRoute>
                <ErpLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/inventory/settings" element={<InventorySettingsPage />} />
            <Route path="/inventory/new" element={<InventoryNewPage />} />
            <Route
              path="/inventory/bundles"
              element={<InventoryBundlesPage />}
            />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/new" element={<ProductCreatePage />} />
            <Route path="/products/:slug/edit" element={<ProductEditPage />} />
            <Route path="/products/:id" element={<ProductPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/orders/new" element={<OrdersNewPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/listings" element={<ListingsPage />} />
            <Route path="/listings/new" element={<ListingCreatePage />} />
            <Route path="/listings/:id/edit" element={<ListingEditPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/tools/ebay-uploader" element={<EbayUploaderPage />} />
          </Route>

          <Route element={<StoreLayout />}>
            <Route path="/" element={<StoreHomePage />} />
            <Route path="/parts" element={<PartsPage />} />
            <Route path="/parts/:slug" element={<ProductPdpPage />} />
            <Route path="/brands" element={<BrandsPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppProviders>
    </BrowserRouter>
  );
}
