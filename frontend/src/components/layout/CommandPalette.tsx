import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command, Plus, Send, RefreshCw, Home, Box, ShoppingCart, Zap } from 'lucide-react';
import clsx from 'clsx';

interface Command {
  id: string;
  label: string;
  category: string;
  icon: React.ReactNode;
  action: string;
  keywords?: string[];
}

const commands: Command[] = [
  {
    id: '1',
    label: 'Go to Dashboard',
    category: 'Navigation',
    icon: <Home size={16} />,
    action: '/dashboard',
    keywords: ['home', 'main'],
  },
  {
    id: '2',
    label: 'Go to Orders',
    category: 'Navigation',
    icon: <ShoppingCart size={16} />,
    action: '/orders',
    keywords: ['comenzi', 'orders'],
  },
  {
    id: '3',
    label: 'Go to Products',
    category: 'Navigation',
    icon: <Box size={16} />,
    action: '/products',
    keywords: ['produse', 'products'],
  },
  {
    id: '4',
    label: 'Go to Inventory',
    category: 'Navigation',
    icon: <Box size={16} />,
    action: '/inventory',
    keywords: ['stocuri', 'stock', 'inventory'],
  },
  {
    id: '5',
    label: 'Go to WMS / Logistics',
    category: 'Navigation',
    icon: <ShoppingCart size={16} />,
    action: '/wms',
    keywords: ['wms', 'logistics', 'warehouse'],
  },
  {
    id: '6',
    label: 'Go to CRM',
    category: 'Navigation',
    icon: <Command size={16} />,
    action: '/crm',
    keywords: ['crm', 'clients', 'customers'],
  },
  {
    id: '7',
    label: 'Go to Analytics',
    category: 'Navigation',
    icon: <Zap size={16} />,
    action: '/analytics',
    keywords: ['analytics', 'reports', 'bi'],
  },
  {
    id: '8',
    label: 'Go to Settings',
    category: 'Navigation',
    icon: <Zap size={16} />,
    action: '/settings',
    keywords: ['settings', 'configuration'],
  },
  {
    id: '9',
    label: 'Create New Order',
    category: 'Actions',
    icon: <Plus size={16} />,
    action: 'create:order',
    keywords: ['new', 'order', 'create'],
  },
  {
    id: '10',
    label: 'Create New Product',
    category: 'Actions',
    icon: <Plus size={16} />,
    action: 'create:product',
    keywords: ['new', 'product', 'create'],
  },
  {
    id: '11',
    label: 'Sync WooCommerce',
    category: 'Actions',
    icon: <RefreshCw size={16} />,
    action: 'sync:woocommerce',
    keywords: ['sync', 'woocommerce', 'update'],
  },
  {
    id: '12',
    label: 'Send Invoice',
    category: 'Actions',
    icon: <Send size={16} />,
    action: 'send:invoice',
    keywords: ['send', 'invoice', 'bill'],
  },
];

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const filtered = commands.filter((cmd) => {
    const searchLower = search.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(searchLower) ||
      cmd.category.toLowerCase().includes(searchLower) ||
      (cmd.keywords && cmd.keywords.some((kw) => kw.includes(searchLower)))
    );
  });

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) =>
          i === 0 ? Math.max(filtered.length - 1, 0) : i - 1
        );
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) {
          if (cmd.action.startsWith('/')) {
            navigate(cmd.action);
          }
          onClose();
        }
      }
    },
    [filtered, selectedIndex, onClose, navigate]
  );

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Group by category
  const groupedCommands = Array.from(
    new Map(filtered.map((cmd) => [cmd.category, cmd])).entries()
  ).map(([category]) => ({
    category,
    commands: filtered.filter((cmd) => cmd.category === category),
  }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />

      {/* Command palette */}
      <div
        className="relative w-full max-w-2xl mx-4 rounded-macos-lg
                   bg-white dark:bg-neutral-900 border border-border dark:border-border-dark
                   shadow-macos-xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="px-6 py-4 border-b border-border dark:border-border-dark">
          <input
            autoFocus
            type="text"
            placeholder="Search commands, pages, actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-lg font-medium text-text-primary
                     placeholder:text-text-tertiary outline-none"
          />
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto scrollbar-hide">
          {filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-text-secondary text-sm">No commands found</p>
              <p className="text-text-tertiary text-2xs mt-1">
                Try searching for pages, actions, or settings
              </p>
            </div>
          ) : (
            <div className="py-2">
              {/* Group by category */}
              {groupedCommands.map(({ category, commands: categoryCommands }) => {
                const categoryStart = filtered.findIndex(
                  (cmd) => cmd.category === category
                );

                return (
                  <div key={category}>
                    <div className="px-6 py-2 text-xs font-semibold uppercase text-text-tertiary">
                      {category}
                    </div>
                    {categoryCommands.map((cmd, idx) => {
                      const globalIdx = categoryStart + idx;
                      const isSelected = globalIdx === selectedIndex;

                      return (
                        <button
                          key={cmd.id}
                          onClick={() => {
                            if (cmd.action.startsWith('/')) {
                              navigate(cmd.action);
                            }
                            onClose();
                          }}
                          className={clsx(
                            'w-full px-6 py-3 flex items-center gap-3 text-sm text-left',
                            'transition-colors duration-100',
                            isSelected
                              ? 'bg-accent text-white'
                              : 'text-text-primary hover:bg-accent/10'
                          )}
                        >
                          <span className="text-lg flex-shrink-0">{cmd.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{cmd.label}</p>
                          </div>
                          {isSelected && (
                            <span className="text-xs opacity-75 flex-shrink-0">⏎</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border dark:border-border-dark bg-neutral-50 dark:bg-neutral-800/50 text-2xs text-text-tertiary flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <kbd className="px-2 py-1 bg-white dark:bg-neutral-700 rounded border border-border dark:border-border-dark text-2xs">↑↓</kbd>
            <span>Navigate</span>
            <kbd className="px-2 py-1 bg-white dark:bg-neutral-700 rounded border border-border dark:border-border-dark text-2xs">⏎</kbd>
            <span>Select</span>
            <kbd className="px-2 py-1 bg-white dark:bg-neutral-700 rounded border border-border dark:border-border-dark text-2xs">ESC</kbd>
            <span>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
