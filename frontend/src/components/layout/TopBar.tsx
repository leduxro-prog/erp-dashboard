/**
 * Enhanced TopBar with Frosted Glass Effect
 * Global search, AI assistant, notifications, and user menu
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ThemeVariant, isDarkTheme } from '../../styles/themes';
import { Search, Bell, User, Sparkles, Command, LogOut, Settings } from 'lucide-react';
import { apiClient } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface TopBarProps {
  breadcrumbs: Breadcrumb[];
  currentTheme: ThemeVariant;
  notificationCount?: number;
  onAIClick: () => void;
  onSearch?: (query: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  breadcrumbs,
  currentTheme,
  notificationCount = 3,
  onAIClick,
  onSearch,
}) => {
  const navigate = useNavigate();
  const isDark = isDarkTheme(currentTheme);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const handleAccountSettings = () => {
    setIsUserMenuOpen(false);
    navigate('/settings');
  };

  const handleLogout = () => {
    apiClient.clearToken();
    useAuthStore.getState().clearAuth();
    localStorage.removeItem('auth-storage');
    setIsUserMenuOpen(false);
    navigate('/login', { replace: true });
  };

  return (
    <div
      className={`
        h-14 flex items-center justify-between px-6 border-b
        backdrop-blur-xl transition-all duration-300
        ${isDark
          ? 'border-gray-800/50 bg-gray-900/30'
          : 'border-gray-200/50 bg-white/30'
        }
      `}
    >
      {/* Left: Breadcrumb Navigation */}
      <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        <span className={`font-medium ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>CYPHER</span>
        {breadcrumbs.length > 0 && (
          <>
            <span>/</span>
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {crumb.href ? (
                  <a href={crumb.href} className={`hover:${isDark ? 'text-gray-200' : 'text-gray-900'} transition-colors`}>
                    {crumb.label}
                  </a>
                ) : (
                  <span>{crumb.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span>/</span>}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Center: Global Search Bar */}
      <div className="flex-1 flex justify-center px-6">
        <div
          className={`
            w-full max-w-md px-3 py-2 rounded-lg border
            flex items-center gap-2
            transition-all duration-200
            ${isDark
              ? 'bg-gray-800/40 border-gray-700 focus-within:border-blue-500/50 focus-within:bg-gray-800/60'
              : 'bg-white/40 border-gray-300/50 focus-within:border-blue-400/50 focus-within:bg-white/60'
            }
          `}
        >
          <Search size={16} className={isDark ? 'text-gray-500' : 'text-gray-500'} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Cauta comenzi, produse, clienti..."
            className={`
              flex-1 bg-transparent outline-none text-sm min-w-0
              ${isDark ? 'text-white placeholder-gray-600' : 'text-gray-900 placeholder-gray-500'}
            `}
          />
          <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${isDark ? 'border-gray-700 text-gray-500' : 'border-gray-300 text-gray-600'}`}>
            <Command size={12} />
            K
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* AI Assistant Button */}
        <button
          onClick={onAIClick}
          className={`
            px-3 py-2 rounded-lg border font-medium text-xs
            flex items-center gap-2
            transition-all duration-200
            ${isDark
              ? 'border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white'
              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
            }
          `}
        >
          <Sparkles size={14} className="text-purple-500" />
          AI
          <span className={`ml-1 text-[10px] ${isDark ? 'opacity-50' : 'opacity-60'}`}>⌘K</span>
        </button>

        {/* Notifications */}
        <button
          className={`
            relative p-2 rounded-lg transition-colors
            ${isDark
              ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              : 'text-gray-600 hover:bg-gray-100'
            }
          `}
        >
          <Bell size={18} />
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {notificationCount}
            </span>
          )}
        </button>

        {/* User Avatar & Menu */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={`
              w-8 h-8 rounded-full overflow-hidden border-2
              transition-all
              ${isDark
                ? 'border-gray-700 hover:border-blue-500/50'
                : 'border-gray-300 hover:border-blue-400/50'
              }
            `}
          >
            <img
              src="https://picsum.photos/40/40?random=2"
              alt="User"
              className="w-full h-full object-cover"
            />
          </button>

          {/* User Dropdown Menu */}
          {isUserMenuOpen && (
            <div
              className={`
                absolute right-0 mt-2 w-48 rounded-lg border shadow-lg
                overflow-hidden
                ${isDark
                  ? 'bg-gray-900 border-gray-700'
                  : 'bg-white border-gray-200'
                }
              `}
            >
              <div className={`p-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Administrator
                </div>
                <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                  admin@cypher.local
                </div>
              </div>

              <button
                onClick={handleAccountSettings}
                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors
                ${isDark
                  ? 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-100'
                }
              `}
              >
                <Settings size={14} />
                Setari Cont
              </button>

              <button
                onClick={handleLogout}
                className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 border-t transition-colors
                ${isDark
                  ? 'border-gray-800 text-red-400 hover:bg-gray-800'
                  : 'border-gray-200 text-red-600 hover:bg-gray-100'
                }
              `}
              >
                <LogOut size={14} />
                Deconectare
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TopBar;
