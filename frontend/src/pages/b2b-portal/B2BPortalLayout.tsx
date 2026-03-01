import React from 'react';
import { Outlet, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useGlobalLanguage } from '../../hooks/useLanguage';
import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';
import { CreditWidget } from '../../components/b2b/CreditWidget';

export const B2BPortalLayout: React.FC = () => {
  const { isAuthenticated, customer, logout } = useB2BAuthStore();
  const { language } = useGlobalLanguage();
  const isRo = language === 'ro';
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate to={`/b2b-store/login?redirect=${encodeURIComponent(location.pathname)}`} replace />
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/b2b-store/login');
  };

  const isActive = (path: string) => location.pathname === path;

  const navLinkClass = (path: string) =>
    `inline-flex items-center px-1 pt-1 pb-4 border-b-2 text-sm font-medium transition-colors ${
      isActive(path)
        ? 'text-gray-900 border-blue-500'
        : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
    }`;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-3 flex flex-col gap-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 truncate">Cypher B2B</h1>
              <span className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-full whitespace-nowrap">
                {customer?.tier}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              <CreditWidget variant="header" />

              <span className="text-sm text-gray-700 truncate max-w-[12rem] sm:max-w-none">
                {customer?.company_name}
              </span>

              <button onClick={handleLogout} className="text-sm text-gray-700 hover:text-gray-900">
                {isRo ? 'Deconectare' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 overflow-x-auto whitespace-nowrap">
            <Link to="/b2b-portal/dashboard" className={navLinkClass('/b2b-portal/dashboard')}>
              {isRo ? 'Tablou de bord' : 'Dashboard'}
            </Link>
            <Link to="/b2b-portal/catalog" className={navLinkClass('/b2b-portal/catalog')}>
              {isRo ? 'Catalog' : 'Catalog'}
            </Link>
            <Link to="/b2b-portal/orders" className={navLinkClass('/b2b-portal/orders')}>
              {isRo ? 'Comenzi' : 'Orders'}
            </Link>
            <Link to="/b2b-portal/cart" className={navLinkClass('/b2b-portal/cart')}>
              {isRo ? 'Coș' : 'Cart'}
            </Link>
            <Link to="/b2b-portal/invoices" className={navLinkClass('/b2b-portal/invoices')}>
              {isRo ? 'Facturi' : 'Invoices'}
            </Link>
            <Link to="/b2b-portal/payments" className={navLinkClass('/b2b-portal/payments')}>
              {isRo ? 'Plăți' : 'Payments'}
            </Link>
            <Link to="/b2b-portal/profile" className={navLinkClass('/b2b-portal/profile')}>
              {isRo ? 'Profil' : 'Profile'}
            </Link>
            <Link to="/b2b-portal/addresses" className={navLinkClass('/b2b-portal/addresses')}>
              {isRo ? 'Adresele mele' : 'My addresses'}
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8 sm:mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            {isRo
              ? '© 2026 Cypher ERP. Portal B2B. Toate drepturile rezervate.'
              : '© 2026 Cypher ERP. B2B Portal. All rights reserved.'}
          </p>
        </div>
      </footer>
    </div>
  );
};
