import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Menu,
  X,
  ShoppingCart,
  LogIn,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Zap,
  Globe,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { B2BChatWidget } from '../../components/Chat/B2BChatWidget';
import { useGlobalLanguage } from '../../hooks/useLanguage';
import { translations, t } from '../../i18n/translations';
import { useCartStore } from '../../stores/cart.store';
import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';

export const B2BStoreLayout: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const { language, toggleLanguage } = useGlobalLanguage();
  const L = translations.layout;
  const { getTotalItems } = useCartStore();
  const { isAuthenticated } = useB2BAuthStore();
  const [companySettings, setCompanySettings] = useState({
    companyName: 'Ledux.ro',
    taxId: '',
    address: 'România',
    phone: '+40 XXX XXX XXX',
    email: 'b2b@ledux.ro',
  });

  useEffect(() => {
    fetchCompanySettings();
  }, []);

  const fetchCompanySettings = async () => {
    try {
      const response = await fetch('/api/v1/settings', {
        credentials: 'include',
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const settings = payload?.data ?? payload;

      if (settings?.general) {
        setCompanySettings({
          companyName: settings.general.companyName || 'Ledux.ro',
          taxId: settings.general.taxId || '',
          address: settings.general.address || 'România',
          phone: settings.general.phone || '+40 XXX XXX XXX',
          email: settings.general.email || 'b2b@ledux.ro',
        });
      }
    } catch (err) {
      console.error('Failed to fetch company settings:', err);
    }
  };

  const navLinks = [
    { name: t(L.nav.home, language), path: '/b2b-store' },
    { name: t(L.nav.catalog, language), path: '/b2b-store/catalog' },
    { name: t(L.nav.about, language), path: '/b2b-store/about' },
    { name: t(L.nav.contact, language), path: '/b2b-store/contact' },
  ];

  const categories = [
    'Corpuri LED',
    'Panouri LED',
    'Spoturi',
    'Proiectoare LED',
    'Benzi LED',
    'Iluminat Industrial',
    'Surse LED',
    'Accesorii',
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0f' }}>
      {/* Announcement Bar */}
      <div
        className="text-white text-xs py-2.5 px-4 text-center"
        style={{ background: 'linear-gradient(90deg, #b8860b 0%, #daa520 50%, #b8860b 100%)' }}
      >
        <span className="font-semibold">{t(L.announcement.text, language)}</span>{' '}
        <Link to="/b2b-store/register" className="underline font-bold hover:text-gray-100 ml-1">
          {t(L.announcement.cta, language)}
        </Link>
      </div>

      {/* Navigation */}
      <nav
        className="border-b sticky top-0 z-50"
        style={{
          background: 'rgba(10, 10, 15, 0.92)',
          backdropFilter: 'blur(16px)',
          borderColor: 'rgba(218, 165, 32, 0.15)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-2.5">
              <Link to="/b2b-store" className="flex items-center gap-2.5">
                <img
                  src="/images/ledux-logo-header.png"
                  alt="Ledux.ro"
                  className="h-10 w-auto"
                  style={{ maxHeight: '40px', filter: 'brightness(0) invert(1)' }}
                />
                <span className="text-xl font-bold tracking-tight text-white">
                  <span style={{ color: '#daa520' }}>B2B</span>
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="text-sm font-medium transition-colors"
                  style={{
                    color: location.pathname === link.path ? '#daa520' : '#a0a0b0',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#daa520')}
                  onMouseLeave={(e) => {
                    if (location.pathname !== link.path) e.currentTarget.style.color = '#a0a0b0';
                  }}
                >
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Desktop Actions */}
            <div className="hidden md:flex items-center gap-4">
              {/* Language Selector */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  color: '#a0a0b0',
                  border: '1px solid rgba(218, 165, 32, 0.2)',
                  background: 'rgba(218, 165, 32, 0.05)',
                }}
                title={language === 'ro' ? 'Switch to English' : 'Schimbă în Română'}
              >
                <Globe size={14} style={{ color: '#daa520' }} />
                {language === 'ro' ? 'RO' : 'EN'}
              </button>

              <Link
                to="/b2b-store/checkout"
                className="relative hover:opacity-80 transition-opacity"
                style={{ color: '#a0a0b0' }}
              >
                <ShoppingCart size={22} />
                {getTotalItems() > 0 && (
                  <span
                    className="absolute -top-1.5 -right-1.5 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center"
                    style={{ background: '#daa520' }}
                  >
                    {getTotalItems()}
                  </span>
                )}
              </Link>

              {isAuthenticated ? (
                <Link to="/b2b-portal/dashboard">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    style={{ color: '#daa520' }}
                  >
                    <Zap size={15} />
                    Portal B2B
                  </Button>
                </Link>
              ) : (
                <Link to="/b2b-store/login">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    style={{ color: '#a0a0b0' }}
                  >
                    <LogIn size={15} />
                    {t(L.auth.login, language)}
                  </Button>
                </Link>
              )}

              {isAuthenticated ? (
                <Link to="/b2b-portal/profile">
                  <Button
                    size="sm"
                    className="gap-1 text-black font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, #daa520, #b8860b)',
                      border: 'none',
                    }}
                  >
                    Contul meu
                    <ChevronRight size={15} />
                  </Button>
                </Link>
              ) : (
                <Link to="/b2b-store/register">
                  <Button
                    size="sm"
                    className="gap-1 text-black font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, #daa520, #b8860b)',
                      border: 'none',
                    }}
                  >
                    {t(L.auth.businessAccount, language)}
                    <ChevronRight size={15} />
                  </Button>
                </Link>
              )}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-3">
              {/* Mobile Language Toggle */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold"
                style={{
                  color: '#daa520',
                  border: '1px solid rgba(218, 165, 32, 0.3)',
                }}
              >
                <Globe size={12} />
                {language === 'ro' ? 'RO' : 'EN'}
              </button>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 rounded-md transition-colors"
                style={{ color: '#a0a0b0' }}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div
            className="md:hidden absolute w-full shadow-2xl"
            style={{ background: '#0f0f18', borderTop: '1px solid rgba(218,165,32,0.1)' }}
          >
            <div className="px-4 pt-2 pb-6 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-3 rounded-md text-base font-medium"
                  style={{
                    color: location.pathname === link.path ? '#daa520' : '#a0a0b0',
                    background:
                      location.pathname === link.path ? 'rgba(218,165,32,0.08)' : 'transparent',
                  }}
                >
                  {link.name}
                </Link>
              ))}
              <div
                className="border-t my-4 pt-4 flex flex-col gap-3 px-3"
                style={{ borderColor: 'rgba(218,165,32,0.1)' }}
              >
                <Link to="/b2b-store/login" onClick={() => setIsMenuOpen(false)}>
                  <Button
                    variant="outline"
                    className="w-full justify-center"
                    style={{ borderColor: '#333', color: '#a0a0b0' }}
                  >
                    {t(L.auth.login, language)}
                  </Button>
                </Link>
                <Link to="/b2b-store/register" onClick={() => setIsMenuOpen(false)}>
                  <Button
                    className="w-full justify-center text-black font-semibold"
                    style={{
                      background: 'linear-gradient(135deg, #daa520, #b8860b)',
                      border: 'none',
                    }}
                  >
                    {t(L.auth.businessAccount, language)}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      <B2BChatWidget />

      {/* Footer */}
      <footer
        style={{ background: '#060609', borderTop: '1px solid rgba(218,165,32,0.1)' }}
        className="py-14"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="col-span-1">
              <div className="flex items-center gap-2.5 mb-5">
                <img
                  src="/images/ledux-logo-footer.png"
                  alt={companySettings.companyName}
                  className="h-8 w-auto"
                  style={{ maxHeight: '32px', filter: 'brightness(0) invert(1)' }}
                />
                <span className="text-lg font-bold text-white tracking-tight">
                  <span style={{ color: '#daa520' }}>B2B</span>
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: '#666' }}>
                {t(L.footer.description, language)}
              </p>
              <div className="space-y-2.5 text-sm" style={{ color: '#555' }}>
                <div className="flex items-center gap-2">
                  <Phone size={13} style={{ color: '#daa520' }} />
                  <span>{companySettings.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={13} style={{ color: '#daa520' }} />
                  <span>{companySettings.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={13} style={{ color: '#daa520' }} />
                  <span>{companySettings.address}</span>
                </div>
              </div>
            </div>

            {/* Categories */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-5"
                style={{ color: '#daa520' }}
              >
                {t(L.footer.categories, language)}
              </h3>
              <ul className="space-y-2.5 text-sm">
                {categories.map((cat) => (
                  <li key={cat}>
                    <Link
                      to="/b2b-store/catalog"
                      className="transition-colors hover:text-white"
                      style={{ color: '#555' }}
                    >
                      {cat}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Info */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-5"
                style={{ color: '#daa520' }}
              >
                {t(L.footer.info, language)}
              </h3>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link
                    to="/b2b-store/about"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.about, language)}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/b2b-store/contact"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.contact, language)}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/b2b-store/how-to-order"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.howToOrder, language)}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/b2b-store/shipping"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.shipping, language)}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/b2b-store/partner"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.partner, language)}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/b2b-store/led-guide"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.techGuide, language)}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/b2b-store/request-quote"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.requestQuote, language)}
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-5"
                style={{ color: '#daa520' }}
              >
                {t(L.footer.legal, language)}
              </h3>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <Link
                    to="/b2b-store/privacy"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.privacy, language)}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/b2b-store/terms"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.terms, language)}
                  </Link>
                </li>
                <li>
                  <Link
                    to="/b2b-store/cookies"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    {t(L.footer.cookies, language)}
                  </Link>
                </li>
                <li>
                  <a
                    href="https://anpc.ro"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-white"
                    style={{ color: '#555' }}
                  >
                    ANPC
                  </a>
                </li>
                {companySettings.taxId && (
                  <li
                    className="pt-2 mt-2"
                    style={{ borderTop: '1px solid rgba(218,165,32,0.08)', color: '#666' }}
                  >
                    CUI: {companySettings.taxId}
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div
            className="mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4"
            style={{ borderTop: '1px solid rgba(218,165,32,0.08)' }}
          >
            <p className="text-xs" style={{ color: '#444' }}>
              &copy; {new Date().getFullYear()} {companySettings.companyName} —{' '}
              {t(L.footer.copyright, language)}
            </p>
            <div className="flex items-center gap-2 text-xs" style={{ color: '#444' }}>
              <Zap size={12} style={{ color: '#daa520' }} />
              <span>Powered by CYPHER ERP</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
