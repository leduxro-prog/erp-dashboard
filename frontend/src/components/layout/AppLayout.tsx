/**
 * Enhanced AppLayout
 * Integrates Sidebar + TopBar + Content + AIAssistant
 */

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { AIAssistant } from '../shared/AIAssistant';
import { ChatWidget } from '../Chat';
import { ThemeVariant } from '../../styles/themes';
import { useUIStore } from '../../stores/ui.store';

interface Breadcrumb {
  label: string;
  href?: string;
}

// Route to breadcrumb mapping
const ROUTE_BREADCRUMBS: Record<string, Breadcrumb[]> = {
  '/': [{ label: 'Dashboard' }],
  '/dashboard': [{ label: 'Dashboard' }],
  '/orders': [{ label: 'Comenzi' }],
  '/products': [{ label: 'Produse' }],
  '/inventory': [{ label: 'Stocuri' }],
  '/pos': [{ label: 'POS' }],
  '/quotations': [{ label: 'Citate' }],
  '/b2b': [{ label: 'Portal B2B' }],
  '/suppliers': [{ label: 'Furnizori' }],
  '/wms': [{ label: 'WMS' }],
  '/smartbill': [{ label: 'Facturi SmartBill' }],
  '/analytics': [{ label: 'Rapoarte' }],
  '/marketing': [{ label: 'Campanii' }],
  '/seo': [{ label: 'SEO' }],
  '/notifications': [{ label: 'Notificari' }],
  '/whatsapp': [{ label: 'WhatsApp' }],
  '/woocommerce': [{ label: 'WooCommerce' }],
  '/configurators': [{ label: 'Configuratoare' }],
  '/crm': [{ label: 'CRM' }],
  '/settings': [{ label: 'Setari' }],
};

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar, theme } = useUIStore();
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<ThemeVariant>(
    (theme === 'dark' ? ThemeVariant.VENTURA_DARK : ThemeVariant.SONOMA_LIGHT) as ThemeVariant
  );

  // Get breadcrumbs from current route
  const breadcrumbs: Breadcrumb[] = ROUTE_BREADCRUMBS[location.pathname] || [
    { label: location.pathname.slice(1).charAt(0).toUpperCase() + location.pathname.slice(2) },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Focus search would be implemented
      }

      // Cmd/Ctrl+J for AI Assistant
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setIsAIOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleThemeChange = (theme: ThemeVariant) => {
    setCurrentTheme(theme);
    // Persist to store if needed
  };

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-gray-900 via-gray-900 to-black overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onCollapsedChange={toggleSidebar}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TopBar */}
        <TopBar
          breadcrumbs={breadcrumbs}
          currentTheme={currentTheme}
          notificationCount={3}
          onAIClick={() => setIsAIOpen(!isAIOpen)}
          onSearch={(query) => {
            console.log('Search:', query);
          }}
        />

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* AI Assistant */}
      <AIAssistant isOpen={isAIOpen} onClose={() => setIsAIOpen(false)} currentTheme={currentTheme} />

      {/* B2B Chatbot Widget */}
      <ChatWidget />
    </div>
  );
};

export default AppLayout;
