import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProviders } from "@/components/providers/app-providers";

// Layouts (inline wrappers)
import { AppShell } from "@/components/shell/app-shell";
import StoreLayout from "@/pages/store/StoreLayout";

// ERP pages
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/erp/DashboardPage";
import InventoryPage from "@/pages/erp/InventoryPage";
import InventoryNewPage from "@/pages/erp/InventoryNewPage";
import InventoryBundlesPage from "@/pages/erp/InventoryBundlesPage";
import ProductPage from "@/pages/erp/ProductPage";
import OrdersPage from "@/pages/erp/OrdersPage";
import OrdersNewPage from "@/pages/erp/OrdersNewPage";
import CustomersPage from "@/pages/erp/CustomersPage";
import SuppliersPage from "@/pages/erp/SuppliersPage";
import ReportsPage from "@/pages/erp/ReportsPage";
import AnalyticsPage from "@/pages/erp/AnalyticsPage";
import ListingsPage from "@/pages/erp/ListingsPage";
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

function ErpLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProviders>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* ERP routes under /app shell */}
          <Route path="/dashboard" element={<ErpLayout><DashboardPage /></ErpLayout>} />
          <Route path="/inventory" element={<ErpLayout><InventoryPage /></ErpLayout>} />
          <Route path="/inventory/new" element={<ErpLayout><InventoryNewPage /></ErpLayout>} />
          <Route path="/inventory/bundles" element={<ErpLayout><InventoryBundlesPage /></ErpLayout>} />
          <Route path="/products/:id" element={<ErpLayout><ProductPage /></ErpLayout>} />
          <Route path="/orders" element={<ErpLayout><OrdersPage /></ErpLayout>} />
          <Route path="/orders/new" element={<ErpLayout><OrdersNewPage /></ErpLayout>} />
          <Route path="/customers" element={<ErpLayout><CustomersPage /></ErpLayout>} />
          <Route path="/suppliers" element={<ErpLayout><SuppliersPage /></ErpLayout>} />
          <Route path="/reports" element={<ErpLayout><ReportsPage /></ErpLayout>} />
          <Route path="/analytics" element={<ErpLayout><AnalyticsPage /></ErpLayout>} />
          <Route path="/listings" element={<ErpLayout><ListingsPage /></ErpLayout>} />
          <Route path="/settings" element={<ErpLayout><SettingsPage /></ErpLayout>} />
          <Route path="/tools/ebay-uploader" element={<ErpLayout><EbayUploaderPage /></ErpLayout>} />

          {/* Store routes */}
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
