import React, { useState, useEffect } from 'react';
import {
  Building, Users, Shield, Globe, Bell, Save, Plus, X, Briefcase,
  Lock, Server, FileText, Loader2, Smartphone, Key
} from 'lucide-react';
import { API_URL } from '../config';
import { apiClient } from '../services/api';

const API_URI = `${API_URL}/settings`;

type SettingsTab = 'general' | 'users' | 'integrations' | 'security' | 'notifications' | 'system' | 'b2b';

interface AppSettings {
  general: {
    companyName: string;
    taxId: string;
    address: string;
    phone: string;
    email: string;
    currency: string;
    vatRate: number;
  };
  integrations: {
    smartbill: { username: string; token: string; cif: string; };
    woocommerce: { url: string; consumerKey: string; consumerSecret: string; };
  };
  b2b: {
    catalogVisibility: 'public' | 'login_only' | 'hidden';
    showPrices: boolean;
    showStock: boolean;
    allowRegistration: boolean;
    autoApprove: boolean;
    minOrderValue: string;
    defaultCreditLimit: string;
  };
  [key: string]: any;
}

export const SettingsPage: React.FC = () => {
  // Default to dark mode or detect from system/local storage if needed. 
  // For now, hardcoding to dark to match the cyber/dark aesthetic of Cypher, 
  // or we could add a hook later.
  const isDark = true;

  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [settings, setSettings] = useState<AppSettings>({
    general: { companyName: '', taxId: '', address: '', phone: '', email: '', currency: 'RON', vatRate: 0.21 },
    integrations: {
      smartbill: { username: '', token: '', cif: '' },
      woocommerce: { url: '', consumerKey: '', consumerSecret: '' }
    },
    b2b: {
      catalogVisibility: 'login_only',
      showPrices: true,
      showStock: false,
      allowRegistration: true,
      autoApprove: false,
      minOrderValue: '500',
      defaultCreditLimit: '5000'
    }
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // User Management State
  const [usersList, setUsersList] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ first_name: '', last_name: '', email: '', password: '', role: 'sales' });

  const fetchUsers = async () => {
    try {
      const users = await apiClient.get('/users');
      setUsersList(users);
    } catch (error) {
      console.error('Failed to fetch users', error);
      setUsersList([]);
    }
  };

  const runCreateUser = async () => {
    if (!newUser.email || !newUser.password) return;
    setSaving(true);
    try {
      await apiClient.post('/users', newUser);
      setMessage({ type: 'success', text: 'User created successfully!' });
      setIsUserModalOpen(false);
      setNewUser({ first_name: '', last_name: '', email: '', password: '', role: 'sales' });
      fetchUsers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to create user.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await apiClient.delete(`/users/${id}`);
      fetchUsers();
      setMessage({ type: 'success', text: 'User deleted.' });
    } catch (error: any) {
      console.error(error);
      setMessage({ type: 'error', text: error.message || 'Failed to delete user.' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    }
  }, [activeTab]);

  const tabs = [
    { id: 'general', label: 'General', icon: Building },
    { id: 'b2b', label: 'Portal B2B', icon: Briefcase },
    { id: 'users', label: 'Utilizatori', icon: Users },
    { id: 'integrations', label: 'Integrări', icon: Globe },
    { id: 'security', label: 'Securitate', icon: Shield },
    { id: 'notifications', label: 'Notificări', icon: Bell },
    { id: 'system', label: 'Sistem', icon: Server },
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URI);
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      } else {
        console.error('Failed to fetch settings');
        // Keep default/mock if fetch fails (e.g. backend down)
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(API_URI, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
        const data = await res.json();
        setSettings(data);
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings.' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error saving settings.' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleChange = (section: string, field: string, value: any, subsection?: string) => {
    setSettings(prev => {
      if (subsection) {
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [subsection]: {
              ...prev[section][subsection],
              [field]: value
            }
          }
        };
      }
      return {
        ...prev,
        [section]: {
          ...prev[section],
          [field]: value
        }
      };
    });
  };

  const renderContent = () => {
    if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /> <span className="text-gray-500 mt-2 block">Loading settings...</span></div>;

    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6">
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Profil Companie</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="company-name" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Nume Companie</label>
                  <input
                    id="company-name"
                    type="text"
                    value={settings.general.companyName}
                    onChange={(e) => handleChange('general', 'companyName', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="tax-id" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>CUI / CIF</label>
                  <input
                    id="tax-id"
                    type="text"
                    value={settings.general.taxId}
                    onChange={(e) => handleChange('general', 'taxId', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="address" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Adresă</label>
                  <input
                    id="address"
                    type="text"
                    value={settings.general.address}
                    onChange={(e) => handleChange('general', 'address', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="phone" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Telefon</label>
                  <input
                    id="phone"
                    type="tel"
                    value={settings.general.phone || ''}
                    onChange={(e) => handleChange('general', 'phone', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="email" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Email</label>
                  <input
                    id="email"
                    type="email"
                    value={settings.general.email || ''}
                    onChange={(e) => handleChange('general', 'email', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="currency" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Monedă</label>
                  <select
                    id="currency"
                    value={settings.general.currency}
                    onChange={(e) => handleChange('general', 'currency', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="RON">RON (lei)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="vat-rate" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Cotă TVA (%)</label>
                  <input
                    id="vat-rate"
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={(settings.general.vatRate || 0.21) * 100}
                    onChange={(e) => handleChange('general', 'vatRate', parseFloat(e.target.value) / 100)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end items-center gap-4">
              {message && <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{message.text}</span>}
              <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvează Modificările
              </button>
            </div>
          </div>
        );

      case 'b2b':
        return (
          <div className="space-y-6">
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Configurare Portal B2B</h3>

              {/* Catalog Visibility */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label htmlFor="catalog-visibility" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Vizibilitate Catalog</label>
                  <select
                    id="catalog-visibility"
                    value={settings.b2b?.catalogVisibility || 'login_only'}
                    onChange={(e) => handleChange('b2b', 'catalogVisibility', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  >
                    <option value="public">Public (Vizibil tuturor)</option>
                    <option value="login_only">Doar după autentificare</option>
                    <option value="hidden">Ascuns (Mod mentenanță)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="approval-mode" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Mod Aprobare Clienți</label>
                  <select
                    id="approval-mode"
                    value={settings.b2b?.approvalMode || 'manual'}
                    onChange={(e) => handleChange('b2b', 'approvalMode', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  >
                    <option value="manual">Manual (Necesită verificare)</option>
                    <option value="auto">Automat (Aprobare instantanee)</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Afișare Prețuri</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" aria-label="Afișare Prețuri" checked={settings.b2b?.showPrices} onChange={(e) => handleChange('b2b', 'showPrices', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Afișare Stocuri</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" aria-label="Afișare Stocuri" checked={settings.b2b?.showStock} onChange={(e) => handleChange('b2b', 'showStock', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Permite Înregistrare Clienți Noi</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" aria-label="Permite Înregistrare Clienți Noi" checked={settings.b2b?.allowRegistration} onChange={(e) => handleChange('b2b', 'allowRegistration', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Aprobare Automată Clienți Noi</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" aria-label="Aprobare Automată Clienți Noi" checked={settings.b2b?.autoApprove} onChange={(e) => handleChange('b2b', 'autoApprove', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Trading Rules */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Reguli Comerciale</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="min-order" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Valoare Minimă Comandă (RON)</label>
                  <input
                    id="min-order"
                    type="number"
                    value={settings.b2b?.minOrderValue}
                    onChange={(e) => handleChange('b2b', 'minOrderValue', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="credit-limit" className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Limită Credit Implicită (RON)</label>
                  <input
                    id="credit-limit"
                    type="number"
                    value={settings.b2b?.defaultCreditLimit}
                    onChange={(e) => handleChange('b2b', 'defaultCreditLimit', e.target.value)}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end items-center gap-4">
              {message && <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{message.text}</span>}
              <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvează Modificările
              </button>
            </div>
          </div>
        );

      case 'integrations':
        return (
          <div className="space-y-6">
            {/* SmartBill */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-700`}><FileText size={24} className="text-blue-500" /></div>
                <div>
                  <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>SmartBill</h4>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Sincronizare Facturare & Contabilitate</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="sb-username" className="block text-xs font-medium mb-1 uppercase text-gray-500">Utilizator / Email</label>
                  <input
                    id="sb-username"
                    type="text"
                    value={settings.integrations?.smartbill?.username || ''}
                    onChange={(e) => handleChange('integrations', 'username', e.target.value, 'smartbill')}
                    className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-1 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="sb-token" className="block text-xs font-medium mb-1 uppercase text-gray-500">API Token</label>
                  <input
                    id="sb-token"
                    type="password"
                    value={settings.integrations?.smartbill?.token || ''}
                    onChange={(e) => handleChange('integrations', 'token', e.target.value, 'smartbill')}
                    className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-1 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="sb-cif" className="block text-xs font-medium mb-1 uppercase text-gray-500">CIF / VAT ID</label>
                  <input
                    id="sb-cif"
                    type="text"
                    value={settings.integrations?.smartbill?.cif || ''}
                    onChange={(e) => handleChange('integrations', 'cif', e.target.value, 'smartbill')}
                    className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-1 focus:ring-blue-500 outline-none`}
                  />
                </div>
              </div>
            </div>

            {/* WooCommerce */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <div className="flex items-center gap-4 mb-6">
                <div className={`p-3 rounded-lg bg-gray-100 dark:bg-gray-700`}><Globe size={24} className="text-purple-500" /></div>
                <div>
                  <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>WooCommerce</h4>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Integrare platformă e-commerce</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="wc-url" className="block text-xs font-medium mb-1 uppercase text-gray-500">URL Magazin</label>
                  <input
                    id="wc-url"
                    type="text"
                    value={settings.integrations?.woocommerce?.url || ''}
                    onChange={(e) => handleChange('integrations', 'url', e.target.value, 'woocommerce')}
                    placeholder="https://example.com"
                    className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-1 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="wc-key" className="block text-xs font-medium mb-1 uppercase text-gray-500">Consumer Key (Cheie Client)</label>
                  <input
                    id="wc-key"
                    type="password"
                    value={settings.integrations?.woocommerce?.consumerKey || ''}
                    onChange={(e) => handleChange('integrations', 'consumerKey', e.target.value, 'woocommerce')}
                    className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-1 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label htmlFor="wc-secret" className="block text-xs font-medium mb-1 uppercase text-gray-500">Consumer Secret (Secret Client)</label>
                  <input
                    id="wc-secret"
                    type="password"
                    value={settings.integrations?.woocommerce?.consumerSecret || ''}
                    onChange={(e) => handleChange('integrations', 'consumerSecret', e.target.value, 'woocommerce')}
                    className={`w-full p-2 text-sm rounded border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-1 focus:ring-blue-500 outline-none`}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end items-center gap-4">
              {message && <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{message.text}</span>}
              <button onClick={saveSettings} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />} Salvează Modificările
              </button>
            </div>
          </div>
        );

      case 'users':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className={`text-lg font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Utilizatori & Roluri</h3>
              <button
                onClick={() => setIsUserModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={18} /> Adaugă Utilizator
              </button>
            </div>

            {/* Users Table */}
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <table className="w-full">
                <thead className={`${isDark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilizator</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Acțiuni</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {usersList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        Nu au fost găsiți utilizatori. Creați unul pentru a începe.
                      </td>
                    </tr>
                  ) : (
                    usersList.map((user: any) => (
                      <tr key={user.id} className={`group ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50'}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center mr-3 ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-blue-100 text-blue-600'}`}>
                              {user.first_name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div>
                              <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.first_name} {user.last_name}</div>
                              <div className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                                        ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                              user.role === 'sales' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'}`}>
                            {user.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {user.isActive ? (
                            <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Activ
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Inactiv
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button onClick={() => deleteUser(user.id)} className="text-red-600 hover:text-red-900 opacity-0 group-hover:opacity-100 transition-opacity">Șterge</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            {/* JWT Settings */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Shield size={20} /> JWT & Autentificare
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Expirare Access Token</label>
                  <select
                    value={settings.security?.jwt?.accessTokenExpiry || '1h'}
                    onChange={(e) => handleChange('security', 'jwt', { ...settings.security?.jwt, accessTokenExpiry: e.target.value })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  >
                    <option value="15m">15 minute</option>
                    <option value="1h">1 oră</option>
                    <option value="4h">4 ore</option>
                    <option value="24h">24 ore</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Expirare Refresh Token</label>
                  <select
                    value={settings.security?.jwt?.refreshTokenExpiry || '7d'}
                    onChange={(e) => handleChange('security', 'jwt', { ...settings.security?.jwt, refreshTokenExpiry: e.target.value })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  >
                    <option value="7d">7 zile</option>
                    <option value="30d">30 zile</option>
                    <option value="90d">90 zile</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Password Policy */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Key size={20} /> Politică Parolă
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Lungime Minimă</label>
                  <input
                    type="number"
                    min="8"
                    max="64"
                    value={settings.security?.password?.minLength || 12}
                    onChange={(e) => handleChange('security', 'password', { ...settings.security?.password, minLength: parseInt(e.target.value) })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Obligă Majuscule</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security?.password?.requireUppercase ?? true}
                      onChange={(e) => handleChange('security', 'password', { ...settings.security?.password, requireUppercase: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Obligă Cifre</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security?.password?.requireNumbers ?? true}
                      onChange={(e) => handleChange('security', 'password', { ...settings.security?.password, requireNumbers: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Obligă Caractere Speciale</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security?.password?.requireSpecialChars ?? true}
                      onChange={(e) => handleChange('security', 'password', { ...settings.security?.password, requireSpecialChars: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* 2FA Settings */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Smartphone size={20} /> Autentificare cu 2 Factori (2FA)
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Activează 2FA în Sistem</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security?.twoFactor?.enabled ?? false}
                      onChange={(e) => handleChange('security', 'twoFactor', { ...settings.security?.twoFactor, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Obligă pentru Administratori (Recomandat)</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security?.twoFactor?.enforceForAdmins ?? false}
                      onChange={(e) => handleChange('security', 'twoFactor', { ...settings.security?.twoFactor, enforceForAdmins: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Account Lockout */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Lock size={20} /> Blocare Cont
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Încercări Maxime</label>
                  <input
                    type="number"
                    min="3"
                    max="10"
                    value={settings.security?.accountLockout?.maxAttempts || 5}
                    onChange={(e) => handleChange('security', 'accountLockout', { ...settings.security?.accountLockout, maxAttempts: parseInt(e.target.value) })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Durata Blocare (minute)</label>
                  <input
                    type="number"
                    min="5"
                    max="120"
                    value={settings.security?.accountLockout?.lockoutDuration || 15}
                    onChange={(e) => handleChange('security', 'accountLockout', { ...settings.security?.accountLockout, lockoutDuration: parseInt(e.target.value) })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
              </div>
            </div>

            {/* Audit Logging */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <FileText size={20} /> Audit Logging
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Activează Audit Logging</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.security?.auditLogging?.enabled ?? true}
                      onChange={(e) => handleChange('security', 'auditLogging', { ...settings.security?.auditLogging, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Retenție Loguri (zile)</label>
                  <input
                    type="number"
                    min="30"
                    max="365"
                    value={settings.security?.auditLogging?.retentionDays || 90}
                    onChange={(e) => handleChange('security', 'auditLogging', { ...settings.security?.auditLogging, retentionDays: parseInt(e.target.value) })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end items-center gap-4">
              {message && <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{message.text}</span>}
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvează Modificările
              </button>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            {/* Email Notifications */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Bell size={20} /> Email & SMTP
              </h3>
              <div className="space-y-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Activează Notificări Email</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications?.email?.enabled ?? false}
                      onChange={(e) => handleChange('notifications', 'email', { ...settings.notifications?.email, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>SMTP Host</label>
                  <input
                    type="text"
                    value={settings.notifications?.email?.smtp?.host || ''}
                    onChange={(e) => handleChange('notifications', 'email', { ...settings.notifications?.email, smtp: { ...settings.notifications?.email?.smtp, host: e.target.value } })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Port</label>
                  <input
                    type="number"
                    value={settings.notifications?.email?.smtp?.port || 587}
                    onChange={(e) => handleChange('notifications', 'email', { ...settings.notifications?.email, smtp: { ...settings.notifications?.email?.smtp, port: parseInt(e.target.value) } })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Username</label>
                  <input
                    type="text"
                    value={settings.notifications?.email?.smtp?.username || ''}
                    onChange={(e) => handleChange('notifications', 'email', { ...settings.notifications?.email, smtp: { ...settings.notifications?.email?.smtp, username: e.target.value } })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Password</label>
                  <input
                    type="password"
                    value={settings.notifications?.email?.smtp?.password || ''}
                    onChange={(e) => handleChange('notifications', 'email', { ...settings.notifications?.email, smtp: { ...settings.notifications?.email?.smtp, password: e.target.value } })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>From Email</label>
                  <input
                    type="email"
                    value={settings.notifications?.email?.smtp?.from || ''}
                    onChange={(e) => handleChange('notifications', 'email', { ...settings.notifications?.email, smtp: { ...settings.notifications?.email?.smtp, from: e.target.value } })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                    placeholder="noreply@company.com"
                  />
                </div>
              </div>
            </div>

            {/* SMS Notifications */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Smartphone size={20} /> SMS Notifications
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Activează SMS</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications?.sms?.enabled ?? false}
                      onChange={(e) => handleChange('notifications', 'sms', { ...settings.notifications?.sms, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Provider</label>
                  <select
                    value={settings.notifications?.sms?.provider || 'twilio'}
                    onChange={(e) => handleChange('notifications', 'sms', { ...settings.notifications?.sms, provider: e.target.value as 'twilio' | 'vonage' | 'custom' })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  >
                    <option value="twilio">Twilio</option>
                    <option value="vonage">Vonage</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>
            </div>

            {/* In-App Notifications */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Bell size={20} /> Notificări In-App
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Activează Notificări In-App</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications?.inApp?.enabled ?? true}
                      onChange={(e) => handleChange('notifications', 'inApp', { ...settings.notifications?.inApp, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Afișează Badge</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications?.inApp?.showBadge ?? true}
                      onChange={(e) => handleChange('notifications', 'inApp', { ...settings.notifications?.inApp, showBadge: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Redă Sunet</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications?.inApp?.playSound ?? true}
                      onChange={(e) => handleChange('notifications', 'inApp', { ...settings.notifications?.inApp, playSound: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Quiet Hours */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Bell size={20} /> Ore Liniștite
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Activează Ore Liniștite</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.notifications?.quietHours?.enabled ?? false}
                      onChange={(e) => handleChange('notifications', 'quietHours', { ...settings.notifications?.quietHours, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Ora Start</label>
                    <input
                      type="time"
                      value={settings.notifications?.quietHours?.startTime || '22:00'}
                      onChange={(e) => handleChange('notifications', 'quietHours', { ...settings.notifications?.quietHours, startTime: e.target.value })}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Ora Sfârșit</label>
                    <input
                      type="time"
                      value={settings.notifications?.quietHours?.endTime || '08:00'}
                      onChange={(e) => handleChange('notifications', 'quietHours', { ...settings.notifications?.quietHours, endTime: e.target.value })}
                      className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end items-center gap-4">
              {message && <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{message.text}</span>}
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvează Modificările
              </button>
            </div>
          </div>
        );

      case 'system':
        return (
          <div className="space-y-6">
            {/* App Configuration */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Server size={20} /> Configurare Aplicație
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Environment</label>
                  <select
                    value={settings.system?.app?.environment || 'production'}
                    onChange={(e) => handleChange('system', 'app', { ...settings.system?.app, environment: e.target.value as 'development' | 'staging' | 'production' })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  >
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Version</label>
                  <input
                    type="text"
                    value={settings.system?.app?.version || '0.1.0'}
                    onChange={(e) => handleChange('system', 'app', { ...settings.system?.app, version: e.target.value })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
              </div>
              <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Debug Mode</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.system?.app?.debugMode ?? false}
                      onChange={(e) => handleChange('system', 'app', { ...settings.system?.app, debugMode: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Maintenance Mode</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.system?.app?.maintenanceMode ?? false}
                      onChange={(e) => handleChange('system', 'app', { ...settings.system?.app, maintenanceMode: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Logging */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <FileText size={20} /> Logging
              </h3>
              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Log Level</label>
                  <select
                    value={settings.system?.logging?.level || 'info'}
                    onChange={(e) => handleChange('system', 'logging', { ...settings.system?.logging, level: e.target.value as 'debug' | 'info' | 'warn' | 'error' })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Console Logging</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.system?.logging?.enableConsole ?? true}
                      onChange={(e) => handleChange('system', 'logging', { ...settings.system?.logging, enableConsole: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>File Logging</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.system?.logging?.enableFile ?? true}
                      onChange={(e) => handleChange('system', 'logging', { ...settings.system?.logging, enableFile: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Performance */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Server size={20} /> Performance
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Enable Caching</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.system?.performance?.caching?.enabled ?? true}
                      onChange={(e) => handleChange('system', 'performance', { ...settings.system?.performance, caching: { ...settings.system?.performance?.caching, enabled: e.target.checked } })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Cache TTL (seconds)</label>
                  <input
                    type="number"
                    value={settings.system?.performance?.caching?.ttl || 3600}
                    onChange={(e) => handleChange('system', 'performance', { ...settings.system?.performance, caching: { ...settings.system?.performance?.caching, ttl: parseInt(e.target.value) } })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Enable Rate Limiting</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.system?.performance?.rateLimit?.enabled ?? true}
                      onChange={(e) => handleChange('system', 'performance', { ...settings.system?.performance, rateLimit: { ...settings.system?.performance?.rateLimit, enabled: e.target.checked } })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>

            {/* Monitoring */}
            <div className={`p-6 rounded-xl border ${isDark ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <h3 className={`text-lg font-medium mb-4 flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                <Server size={20} /> Monitoring
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Enable Monitoring</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.system?.monitoring?.enabled ?? true}
                      onChange={(e) => handleChange('system', 'monitoring', { ...settings.system?.monitoring, enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Grafana URL</label>
                  <input
                    type="text"
                    value={settings.system?.monitoring?.grafanaUrl || 'http://localhost:3002'}
                    onChange={(e) => handleChange('system', 'monitoring', { ...settings.system?.monitoring, grafanaUrl: e.target.value })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                    placeholder="http://localhost:3002"
                  />
                </div>
                <div>
                  <label className={`block text-sm font-medium mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Alert Email</label>
                  <input
                    type="email"
                    value={settings.system?.monitoring?.alertEmail || ''}
                    onChange={(e) => handleChange('system', 'monitoring', { ...settings.system?.monitoring, alertEmail: e.target.value })}
                    className={`w-full p-2 rounded-lg border ${isDark ? 'bg-gray-900 border-gray-700 text-white' : 'bg-white border-gray-200'} focus:ring-2 focus:ring-blue-500 outline-none`}
                    placeholder="admin@company.com"
                  />
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end items-center gap-4">
              {message && <span className={`text-sm ${message.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>{message.text}</span>}
              <button
                onClick={saveSettings}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvează Modificările
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className={`p-12 rounded-xl border text-center ${isDark ? 'bg-gray-800/30 border-gray-700' : 'bg-white border-gray-200 border-dashed'}`}>
            <Lock size={48} className={`mx-auto mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
            <h3 className={`text-lg font-medium ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Acces Restricționat</h3>
            <p className={`mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
              Configurarea avansată pentru {activeTab} este disponibilă doar Administratorilor.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 h-full">
      {/* Settings Navigation */}
      <div className="w-full md:w-64 flex-shrink-0">
        <h2 className={`text-2xl font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h2>
        <div className="space-y-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-left
                ${activeTab === tab.id
                  ? (isDark ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'bg-blue-50 text-blue-700 border border-blue-100')
                  : (isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}`}
            >
              <tab.icon size={18} />
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {renderContent()}
      </div>
      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl ${isDark ? 'bg-gray-900 border border-gray-700' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Adaugă Utilizator Nou</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="text-gray-500 hover:text-gray-700" title="Închide"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="new-first-name" className="block text-sm font-medium mb-1 text-gray-500">Prenume</label>
                <input
                  id="new-first-name"
                  type="text"
                  value={newUser.first_name}
                  onChange={e => setNewUser({ ...newUser, first_name: e.target.value })}
                  className={`w-full p-2 rounded border outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`}
                  required
                />
              </div>
              <div>
                <label htmlFor="new-last-name" className="block text-sm font-medium mb-1 text-gray-500">Nume</label>
                <input
                  id="new-last-name"
                  type="text"
                  value={newUser.last_name}
                  onChange={e => setNewUser({ ...newUser, last_name: e.target.value })}
                  className={`w-full p-2 rounded border outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`}
                  required
                />
              </div>
              <div>
                <label htmlFor="new-email" className="block text-sm font-medium mb-1 text-gray-500">Email</label>
                <input
                  id="new-email"
                  type="email"
                  value={newUser.email}
                  onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                  className={`w-full p-2 rounded border outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`}
                  required
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium mb-1 text-gray-500">Parolă</label>
                <input
                  id="new-password"
                  type="password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className={`w-full p-2 rounded border outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`}
                />
              </div>
              <div>
                <label htmlFor="new-role" className="block text-sm font-medium mb-1 text-gray-500">Rol</label>
                <select
                  id="new-role"
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className={`w-full p-2 rounded border outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-white border-gray-200'}`}
                >
                  <option value="sales">Sales (Vânzări)</option>
                  <option value="inventory">Inventory (Gestiune)</option>
                  <option value="finance">Finance (Financiar)</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin (Administrator)</option>
                  <option value="b2b_client">B2B Client</option>
                  <option value="guest">Guest (Vizitator)</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg">Anulează</button>
                <button onClick={runCreateUser} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  {saving ? 'Se creează...' : 'Creează Utilizator'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;

