/**
 * Enhanced Sidebar with Theme Switcher
 * Premium Nexus-quality design with macOS aesthetics
 */

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeVariant, isDarkTheme } from '../../styles/themes';
import { useAuthStore } from '../../stores/auth.store';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Warehouse,
  PieChart,
  Megaphone,
  Send,
  Zap,
  BarChart3,
  Users,
  ListChecks,
  TrendingUp,
  Moon,
  Sun,
  Monitor,
  X,
  Menu,
  FileText,
  Upload,
  ShieldCheck,
} from 'lucide-react';

interface NavSection {
  label: string;
  items: NavItem[];
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  badge?: string;
}

interface SidebarProps {
  isCollapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  currentTheme: ThemeVariant;
  onThemeChange: (theme: ThemeVariant) => void;
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onCollapsedChange,
  currentTheme,
  onThemeChange,
  isMobileOpen = false,
  onMobileClose,
}) => {
  const isDark = isDarkTheme(currentTheme);
  const location = useLocation();
  const authUser = useAuthStore((state) => state.user);
  const shouldCollapse = isCollapsed && !isMobileOpen;

  const isActive = (href: string) =>
    href === '/'
      ? location.pathname === '/'
      : location.pathname === href || location.pathname.startsWith(href);

  const closeMobileSidebar = () => {
    onMobileClose?.();
  };

  const navigationSections: NavSection[] = [
    {
      label: 'PRINCIPAL',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, href: '/' },
        { id: 'orders', label: 'Comenzi', icon: <ShoppingCart size={18} />, href: '/orders' },
        { id: 'products', label: 'Produse', icon: <Package size={18} />, href: '/products' },
        { id: 'inventory', label: 'Stocuri', icon: <Warehouse size={18} />, href: '/inventory' },
      ],
    },
    {
      label: 'VANZARI',
      items: [
        { id: 'pos', label: 'POS', icon: <TrendingUp size={18} />, href: '/pos' },
        { id: 'quotations', label: 'Ofertare', icon: <FileText size={18} />, href: '/quotations' },
        { id: 'b2b', label: 'Portal B2B', icon: <BarChart3 size={18} />, href: '/b2b' },
        {
          id: 'b2b-admin',
          label: 'Admin B2B',
          icon: <ShieldCheck size={18} />,
          href: '/b2b-admin',
        },
      ],
    },
    {
      label: 'DEPOZIT',
      items: [
        { id: 'wms', label: 'WMS', icon: <Warehouse size={18} />, href: '/wms' },
        { id: 'suppliers', label: 'Furnizori', icon: <Zap size={18} />, href: '/suppliers' },
      ],
    },
    {
      label: 'FINANCIAR',
      items: [
        {
          id: 'smartbill',
          label: 'Facturi SmartBill',
          icon: <PieChart size={18} />,
          href: '/smartbill',
        },
        {
          id: 'import-prices',
          label: 'Import Prețuri',
          icon: <Upload size={18} />,
          href: '/import-prices',
        },
        { id: 'analytics', label: 'Rapoarte', icon: <BarChart3 size={18} />, href: '/analytics' },
      ],
    },
    {
      label: 'MARKETING',
      items: [
        { id: 'marketing', label: 'Campanii', icon: <Megaphone size={18} />, href: '/marketing' },
        { id: 'seo', label: 'SEO', icon: <TrendingUp size={18} />, href: '/seo' },
      ],
    },
    {
      label: 'COMUNICARE',
      items: [
        {
          id: 'notifications',
          label: 'Notificari',
          icon: <Send size={18} />,
          href: '/notifications',
        },
        { id: 'whatsapp', label: 'WhatsApp', icon: <Send size={18} />, href: '/whatsapp' },
      ],
    },
    {
      label: 'INTEGRARI',
      items: [
        { id: 'woocommerce', label: 'WooCommerce', icon: <Zap size={18} />, href: '/woocommerce' },
        {
          id: 'configurators',
          label: 'Configuratoare',
          icon: <Package size={18} />,
          href: '/configurators',
        },
      ],
    },
    {
      label: 'ANALYTICS',
      items: [
        { id: 'crm', label: 'CRM', icon: <BarChart3 size={18} />, href: '/crm' },
        { id: 'hr', label: 'HR', icon: <Users size={18} />, href: '/hr' },
        {
          id: 'forecasting',
          label: 'Previziuni',
          icon: <TrendingUp size={18} />,
          href: '/analytics?tab=forecasting',
        },
      ],
    },
    {
      label: 'SYSTEM',
      items: [
        { id: 'settings', label: 'Configurări', icon: <Zap size={18} />, href: '/settings' },
        { id: 'audit-log', label: 'Audit Log', icon: <ListChecks size={18} />, href: '/audit-log' },
      ],
    },
  ];

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-30 bg-black/45 lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col h-[100dvh] bg-gradient-to-b border-r backdrop-blur-xl
          transition-all duration-300 ease-out
          ${isDark ? 'from-gray-900 to-gray-950 border-gray-800' : 'from-white to-gray-50 border-gray-200'}
          w-72 max-w-[85vw] lg:relative lg:z-auto lg:translate-x-0 lg:h-[100dvh]
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${shouldCollapse ? 'lg:w-20' : 'lg:w-64'}
        `}
      >
        {/* Header with macOS Traffic Lights */}
        <div
          className={`p-4 flex items-center gap-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}
        >
          {!shouldCollapse && (
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80 hover:bg-yellow-500 transition-colors cursor-pointer" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors cursor-pointer" />
            </div>
          )}
          <button
            onClick={closeMobileSidebar}
            className={`ml-auto p-1.5 rounded-lg transition-colors lg:hidden ${
              isDark
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'
            }`}
          >
            <X size={18} />
          </button>

          <button
            onClick={() => onCollapsedChange(!isCollapsed)}
            className={`ml-auto p-1.5 rounded-lg transition-colors hidden lg:inline-flex ${
              isDark
                ? 'hover:bg-gray-800 text-gray-400 hover:text-gray-200'
                : 'hover:bg-gray-200 text-gray-600 hover:text-gray-900'
            }`}
          >
            {shouldCollapse ? <Menu size={18} /> : <X size={18} />}
          </button>
        </div>

        {/* User Mini Profile */}
        {!shouldCollapse && (
          <div
            className={`px-4 py-4 flex items-center gap-3 ${isDark ? 'border-b border-gray-800' : 'border-b border-gray-200'}`}
          >
            <div
              className={`w-10 h-10 rounded-full border-2 transition-all flex items-center justify-center text-sm font-bold ${isDark ? 'border-blue-500/50 bg-blue-600/20 text-blue-400' : 'border-blue-400/50 bg-blue-100 text-blue-600'}`}
            >
              {authUser?.name
                ? authUser.name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}
              >
                {authUser?.name || 'Utilizator'}
              </div>
              <div className={`text-xs truncate ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                {authUser?.role
                  ? authUser.role.charAt(0).toUpperCase() + authUser.role.slice(1)
                  : 'User'}
              </div>
            </div>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navigationSections.map((section) => (
            <div key={section.label}>
              {!shouldCollapse && (
                <div
                  className={`px-3 text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                >
                  {section.label}
                </div>
              )}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.href}
                    onClick={closeMobileSidebar}
                    className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-200 group relative
                    ${
                      isActive(item.href)
                        ? isDark
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
                          : 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                        : isDark
                          ? 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                  >
                    <div
                      className={`transition-all ${isActive(item.href) ? 'scale-110' : 'group-hover:scale-105'}`}
                    >
                      {item.icon}
                    </div>

                    {!shouldCollapse && (
                      <>
                        <span className="font-medium text-sm flex-1">{item.label}</span>
                        {isActive(item.href) && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        )}
                        {item.badge && (
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Theme Switcher */}
        <div
          className={`p-4 border-t ${isDark ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50/50'}`}
        >
          <div
            className={`flex gap-1.5 p-1.5 rounded-lg backdrop-blur-sm ${isDark ? 'bg-black/20' : 'bg-white/50'}`}
          >
            {[
              { variant: ThemeVariant.VENTURA_DARK, icon: Moon, tooltip: 'Ventura' },
              { variant: ThemeVariant.SONOMA_LIGHT, icon: Sun, tooltip: 'Sonoma' },
              { variant: ThemeVariant.MONTEREY_PRO, icon: Monitor, tooltip: 'Monterey' },
            ].map(({ variant, icon: Icon, tooltip }) => (
              <button
                key={variant}
                onClick={() => onThemeChange(variant)}
                title={tooltip}
                className={`
                flex-1 flex items-center justify-center py-2 rounded-md
                transition-all duration-200 relative group
                ${
                  currentTheme === variant
                    ? isDark
                      ? 'bg-gray-700/80 text-white shadow-md'
                      : 'bg-white text-blue-600 shadow-md'
                    : isDark
                      ? 'text-gray-500 hover:text-gray-300'
                      : 'text-gray-500 hover:text-gray-700'
                }
              `}
              >
                <Icon size={16} />
                {!shouldCollapse && (
                  <span
                    className={`absolute bottom-full mb-1 px-2 py-1 text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${
                      isDark ? 'bg-gray-800 text-gray-200' : 'bg-gray-900 text-white'
                    }`}
                  >
                    {tooltip}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Version Badge */}
        {!shouldCollapse && (
          <div
            className={`px-4 py-3 text-center text-xs font-semibold tracking-wider ${isDark ? 'text-gray-600' : 'text-gray-500'}`}
          >
            CYPHER ERP v1.0
          </div>
        )}
      </aside>
    </>
  );
};

export default Sidebar;
