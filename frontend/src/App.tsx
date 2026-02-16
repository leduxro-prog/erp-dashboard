import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { LoadingSkeleton } from './components/ui/LoadingSkeleton';
import { apiClient } from './services/api';

// Lazy load pages
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const OrdersPage = lazy(() =>
  import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })),
);
const ProductsPage = lazy(() =>
  import('./pages/ProductsPage').then((m) => ({ default: m.ProductsPage })),
);
const InventoryPage = lazy(() =>
  import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })),
);
const POSPage = lazy(() => import('./pages/POSPage').then((m) => ({ default: m.POSPage })));
const QuotationsPage = lazy(() =>
  import('./pages/QuotationsPage').then((m) => ({ default: m.QuotationsPage })),
);
const B2BPortalPage = lazy(() =>
  import('./pages/B2BPortalPage').then((m) => ({ default: m.B2BPortalPage })),
);
const B2BAdminPage = lazy(() =>
  import('./pages/B2BAdminPage').then((m) => ({ default: m.B2BAdminPage })),
);
const B2BStoreLayout = lazy(() =>
  import('./pages/b2b-store/B2BStoreLayout').then((m) => ({ default: m.B2BStoreLayout })),
);
const B2BStoreLandingPage = lazy(() =>
  import('./pages/b2b-store/B2BStoreLandingPage').then((m) => ({ default: m.B2BStoreLandingPage })),
);
const B2BStoreCatalogPage = lazy(() =>
  import('./pages/b2b-store/B2BStoreCatalogPage').then((m) => ({ default: m.B2BStoreCatalogPage })),
);
const B2BPublicCheckoutPage = lazy(() =>
  import('./pages/b2b/B2BCheckoutPage').then((m) => ({ default: m.B2BCheckoutPage })),
);
const B2BRegistrationPage = lazy(() =>
  import('./pages/b2b-store/B2BRegistrationPage').then((m) => ({ default: m.B2BRegistrationPage })),
);
const B2BLoginPage = lazy(() =>
  import('./pages/b2b-store/B2BLoginPage').then((m) => ({ default: m.B2BLoginPage })),
);
const B2BForgotPasswordPage = lazy(() =>
  import('./pages/b2b-store/B2BForgotPasswordPage').then((m) => ({
    default: m.B2BForgotPasswordPage,
  })),
);
const B2BResetPasswordPage = lazy(() =>
  import('./pages/b2b-store/B2BResetPasswordPage').then((m) => ({
    default: m.B2BResetPasswordPage,
  })),
);
const B2BPortalLayout = lazy(() =>
  import('./pages/b2b-portal/B2BPortalLayout').then((m) => ({ default: m.B2BPortalLayout })),
);
const B2BDashboardPage = lazy(() =>
  import('./pages/b2b-portal/B2BDashboardPage').then((m) => ({ default: m.B2BDashboardPage })),
);
const B2BOrdersPage = lazy(() =>
  import('./pages/b2b-portal/B2BOrdersPage').then((m) => ({ default: m.B2BOrdersPage })),
);
const B2BOrderDetailPage = lazy(() =>
  import('./pages/b2b-portal/B2BOrderDetailPage').then((m) => ({ default: m.B2BOrderDetailPage })),
);
const B2BInvoicesPage = lazy(() =>
  import('./pages/b2b-portal/B2BInvoicesPage').then((m) => ({ default: m.B2BInvoicesPage })),
);
const B2BCartPage = lazy(() =>
  import('./pages/b2b-portal/B2BCartPage').then((m) => ({ default: m.B2BCartPage })),
);
const B2BCheckoutPage = lazy(() =>
  import('./pages/b2b-portal/B2BCheckoutPage').then((m) => ({ default: m.B2BCheckoutPage })),
);
const B2BProfilePage = lazy(() =>
  import('./pages/b2b-portal/B2BProfilePage').then((m) => ({ default: m.B2BProfilePage })),
);
const B2BAddressesPage = lazy(() =>
  import('./pages/b2b-portal/B2BAddressesPage').then((m) => ({ default: m.B2BAddressesPage })),
);
const B2BPaymentsPage = lazy(() =>
  import('./pages/b2b-portal/B2BPaymentsPage').then((m) => ({ default: m.B2BPaymentsPage })),
);
const B2BProductDetailPage = lazy(() =>
  import('./pages/b2b-store/B2BProductDetailPage').then((m) => ({
    default: m.B2BProductDetailPage,
  })),
);
const B2BAboutPage = lazy(() =>
  import('./pages/b2b-store/B2BAboutPage').then((m) => ({ default: m.B2BAboutPage })),
);
const B2BContactPage = lazy(() =>
  import('./pages/b2b-store/B2BContactPage').then((m) => ({ default: m.B2BContactPage })),
);
const B2BHowToOrderPage = lazy(() =>
  import('./pages/b2b-store/B2BHowToOrderPage').then((m) => ({ default: m.B2BHowToOrderPage })),
);
const B2BShippingPage = lazy(() =>
  import('./pages/b2b-store/B2BShippingPage').then((m) => ({ default: m.B2BShippingPage })),
);
const B2BPartnerPage = lazy(() =>
  import('./pages/b2b-store/B2BPartnerPage').then((m) => ({ default: m.B2BPartnerPage })),
);
const B2BLedGuidePage = lazy(() =>
  import('./pages/b2b-store/B2BLedGuidePage').then((m) => ({ default: m.B2BLedGuidePage })),
);
const B2BRequestQuotePage = lazy(() =>
  import('./pages/b2b-store/B2BRequestQuotePage').then((m) => ({ default: m.B2BRequestQuotePage })),
);
const B2BPrivacyPage = lazy(() =>
  import('./pages/b2b-store/B2BPrivacyPage').then((m) => ({ default: m.B2BPrivacyPage })),
);
const B2BTermsPage = lazy(() =>
  import('./pages/b2b-store/B2BTermsPage').then((m) => ({ default: m.B2BTermsPage })),
);
const B2BCookiesPage = lazy(() =>
  import('./pages/b2b-store/B2BCookiesPage').then((m) => ({ default: m.B2BCookiesPage })),
);
const SuppliersPage = lazy(() =>
  import('./pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
);
const WMSPage = lazy(() => import('./pages/WMSPage').then((m) => ({ default: m.WMSPage })));
const SmartBillPage = lazy(() =>
  import('./pages/SmartBillPage').then((m) => ({ default: m.SmartBillPage })),
);
const ImportPricesPage = lazy(() => import('./pages/ImportPrices'));
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const MarketingPage = lazy(() =>
  import('./pages/MarketingPage').then((m) => ({ default: m.MarketingPage })),
);
const SeoPage = lazy(() => import('./pages/SeoPage').then((m) => ({ default: m.SeoPage })));
const NotificationsPage = lazy(() =>
  import('./pages/NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
);
const WhatsAppPage = lazy(() =>
  import('./pages/WhatsAppPage').then((m) => ({ default: m.WhatsAppPage })),
);
const WooCommercePage = lazy(() =>
  import('./pages/WooCommercePage').then((m) => ({ default: m.WooCommercePage })),
);
const ConfiguratorsPage = lazy(() =>
  import('./pages/ConfiguratorsPage').then((m) => ({ default: m.ConfiguratorsPage })),
);
const CRMPage = lazy(() => import('./pages/CRMPage').then((m) => ({ default: m.CRMPage })));
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const AuditLogPage = lazy(() =>
  import('./pages/AuditLogPage').then((m) => ({ default: m.AuditLogPage })),
);
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ForgotPasswordPage = lazy(() =>
  import('./pages/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import('./pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);

// Setup React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      gcTime: 600000,
      retry: 1,
    },
  },
});

// Loading fallback
const PageLoadingFallback = () => <LoadingSkeleton />;

const hasErpSession = () => Boolean(apiClient.getToken());

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        <Route
          path="/login"
          element={
            hasErpSession() ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Suspense fallback={<PageLoadingFallback />}>
                <LoginPage />
              </Suspense>
            )
          }
        />
        <Route
          path="/forgot-password"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <ForgotPasswordPage />
            </Suspense>
          }
        />
        <Route
          path="/reset-password"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <ResetPasswordPage />
            </Suspense>
          }
        />

        {/* Public routes */}
        <Route
          path="checkout"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <B2BPublicCheckoutPage />
            </Suspense>
          }
        />

        {/* Public B2B Store Routes */}
        <Route
          path="/b2b-store"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <B2BStoreLayout />
            </Suspense>
          }
        >
          <Route
            index
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BStoreLandingPage />
              </Suspense>
            }
          />
          <Route
            path="register"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BRegistrationPage />
              </Suspense>
            }
          />
          <Route
            path="login"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BLoginPage />
              </Suspense>
            }
          />
          <Route
            path="forgot-password"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BForgotPasswordPage />
              </Suspense>
            }
          />
          <Route
            path="reset-password"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BResetPasswordPage />
              </Suspense>
            }
          />
          <Route
            path="catalog"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BStoreCatalogPage />
              </Suspense>
            }
          />
          <Route
            path="checkout"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BCheckoutPage />
              </Suspense>
            }
          />
          <Route
            path="product/:id"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BProductDetailPage />
              </Suspense>
            }
          />
          <Route
            path="about"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BAboutPage />
              </Suspense>
            }
          />
          <Route
            path="contact"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BContactPage />
              </Suspense>
            }
          />
          <Route
            path="how-to-order"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BHowToOrderPage />
              </Suspense>
            }
          />
          <Route
            path="shipping"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BShippingPage />
              </Suspense>
            }
          />
          <Route
            path="partner"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BPartnerPage />
              </Suspense>
            }
          />
          <Route
            path="led-guide"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BLedGuidePage />
              </Suspense>
            }
          />
          <Route
            path="request-quote"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BRequestQuotePage />
              </Suspense>
            }
          />
          <Route
            path="privacy"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BPrivacyPage />
              </Suspense>
            }
          />
          <Route
            path="terms"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BTermsPage />
              </Suspense>
            }
          />
          <Route
            path="cookies"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BCookiesPage />
              </Suspense>
            }
          />
        </Route>

        {/* B2B Portal - Authenticated Customer Routes */}
        <Route
          path="/b2b-portal"
          element={
            <Suspense fallback={<PageLoadingFallback />}>
              <B2BPortalLayout />
            </Suspense>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BDashboardPage />
              </Suspense>
            }
          />
          <Route
            path="orders"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BOrdersPage />
              </Suspense>
            }
          />
          <Route
            path="orders/:id"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BOrderDetailPage />
              </Suspense>
            }
          />
          <Route
            path="invoices"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BInvoicesPage />
              </Suspense>
            }
          />
          <Route
            path="cart"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BCartPage />
              </Suspense>
            }
          />
          <Route
            path="checkout"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BCheckoutPage />
              </Suspense>
            }
          />
          <Route
            path="profile"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BProfilePage />
              </Suspense>
            }
          />
          <Route
            path="addresses"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BAddressesPage />
              </Suspense>
            }
          />
          <Route
            path="payments"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BPaymentsPage />
              </Suspense>
            }
          />
          <Route
            path="catalog"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BStoreCatalogPage />
              </Suspense>
            }
          />
        </Route>

        {/* Protected routes with layout */}
        <Route
          path="/"
          element={hasErpSession() ? <AppLayout /> : <Navigate to="/login" replace />}
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* Principal */}
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="orders/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <OrdersPage />
              </Suspense>
            }
          />
          <Route
            path="products/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <ProductsPage />
              </Suspense>
            }
          />
          <Route
            path="inventory/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <InventoryPage />
              </Suspense>
            }
          />

          {/* Vanzari */}
          <Route
            path="pos/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <POSPage />
              </Suspense>
            }
          />
          <Route
            path="quotations/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <QuotationsPage />
              </Suspense>
            }
          />
          <Route
            path="b2b/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BPortalPage />
              </Suspense>
            }
          />
          <Route
            path="b2b-admin"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <B2BAdminPage />
              </Suspense>
            }
          />

          {/* Depozit */}
          <Route
            path="wms/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <WMSPage />
              </Suspense>
            }
          />
          <Route
            path="suppliers/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <SuppliersPage />
              </Suspense>
            }
          />

          {/* Financiar */}
          <Route
            path="smartbill/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <SmartBillPage />
              </Suspense>
            }
          />
          <Route
            path="import-prices"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <ImportPricesPage />
              </Suspense>
            }
          />
          <Route
            path="analytics/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <AnalyticsPage />
              </Suspense>
            }
          />

          {/* Marketing */}
          <Route
            path="marketing/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <MarketingPage />
              </Suspense>
            }
          />
          <Route
            path="seo/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <SeoPage />
              </Suspense>
            }
          />

          {/* Comunicare */}
          <Route
            path="notifications/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <NotificationsPage />
              </Suspense>
            }
          />
          <Route
            path="whatsapp/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <WhatsAppPage />
              </Suspense>
            }
          />

          {/* Integrari */}
          <Route
            path="woocommerce/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <WooCommercePage />
              </Suspense>
            }
          />
          <Route
            path="configurators/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <ConfiguratorsPage />
              </Suspense>
            }
          />

          {/* CRM */}
          <Route
            path="crm/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <CRMPage />
              </Suspense>
            }
          />

          {/* System */}
          <Route
            path="settings/*"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route
            path="audit-log"
            element={
              <Suspense fallback={<PageLoadingFallback />}>
                <AuditLogPage />
              </Suspense>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </QueryClientProvider>
  );
}
