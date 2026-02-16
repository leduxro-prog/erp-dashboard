import React, { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  ShoppingCart,
  Eye,
  Grid3X3,
  List,
  ChevronDown,
  Loader,
  X,
  Package,
  Zap,
  Thermometer,
  Droplets,
  CheckCircle,
  Shield,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { b2bApi } from '../../services/b2b-api';
import { useCartStore } from '../../stores/cart.store';
import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';

interface Product {
  id: number;
  name: string;
  sku: string;
  description: string;
  price: number;
  currency: string;
  image_url: string;
  stock_local: number;
  stock_supplier: number;
  supplier_lead_time: number;
  rating?: number;
  category?: string;
}

// Specs parser - extract lighting specs from product name/description
const parseSpecs = (product: Product) => {
  const text = `${product.name} ${product.description}`.toLowerCase();
  const wattMatch = text.match(/(\d+)\s*w(?:att)?/i);
  const kelvinMatch = text.match(/(\d{4})\s*k/i);
  const ipMatch = text.match(/ip\s*(\d{2,3})/i);
  const lumenMatch = text.match(/(\d+)\s*(?:lm|lumen)/i);
  return {
    watt: wattMatch ? `${wattMatch[1]}W` : null,
    kelvin: kelvinMatch ? kelvinMatch[1] : null, // Returns "4000"
    ip: ipMatch ? `IP${ipMatch[1]}` : null, // Returns "IP65"
    lumen: lumenMatch ? `${lumenMatch[1]}lm` : null,
  };
};

const lightingCategories = [
  'Toate Produsele',
  'Corpuri LED',
  'Panouri LED',
  'Spoturi & Downlight',
  'Proiectoare LED',
  'Tuburi LED T8/T5',
  'Benzi LED',
  'Surse & Becuri LED',
  'Iluminat Industrial',
  'Accesorii',
];

const kelvinOptions = [
  { label: '3000K Alb Cald', value: '3000' },
  { label: '4000K Alb Neutru', value: '4000' },
  { label: '6500K Alb Rece', value: '6500' },
];

const ipOptions = [
  { label: 'IP20 — Interior', value: 'IP20' },
  { label: 'IP44 — Umezeală', value: 'IP44' },
  { label: 'IP65 — Exterior', value: 'IP65' },
  { label: 'IP67 — Submersibil', value: 'IP67' },
];

const sortOptions = [
  { label: 'Cele mai noi', value: 'newest' },
  { label: 'Preț crescător', value: 'price_asc' },
  { label: 'Preț descrescător', value: 'price_desc' },
  { label: 'Denumire A-Z', value: 'name_asc' },
  { label: 'Popularitate', value: 'popularity' },
];

export const B2BStoreCatalogPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toate Produsele');
  const [selectedKelvin, setSelectedKelvin] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'local' | 'supplier'>('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
  const [addedToCart, setAddedToCart] = useState<number | null>(null);
  const [b2bSettings, setB2bSettings] = useState({
    showPrices: true,
    showStock: true,
    catalogVisibility: 'public' as 'public' | 'login_only' | 'hidden',
  });

  const [availableCategories, setAvailableCategories] = useState<string[]>(lightingCategories);
  const [availableFilters, setAvailableFilters] = useState<{ kelvin: any[]; ip: any[] }>({
    kelvin: kelvinOptions,
    ip: ipOptions,
  });

  const { addItem } = useCartStore();
  const { isAuthenticated } = useB2BAuthStore();
  const location = useLocation();

  useEffect(() => {
    fetchB2BSettings();
    loadFilters();
  }, []);

  const loadFilters = async () => {
    try {
      const [cats, filters] = await Promise.all([b2bApi.getCategories(), b2bApi.getFilters()]);

      if (cats && Array.isArray(cats)) {
        setAvailableCategories(['Toate Produsele', ...cats]);
      }

      if (filters) {
        setAvailableFilters({
          kelvin: filters.kelvin || kelvinOptions,
          ip: filters.ip || ipOptions,
        });
      }
    } catch (err) {
      console.error('Failed to fetch filters:', err);
      // Fallback to defaults already in state
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [
    searchQuery,
    selectedCategory,
    selectedKelvin,
    selectedIp,
    priceMin,
    priceMax,
    sortBy,
    stockFilter,
    isAuthenticated,
  ]);

  const fetchB2BSettings = async () => {
    try {
      const response = await fetch('/api/v1/settings', {
        credentials: 'include',
      });

      if (!response.ok) {
        return;
      }

      const payload = await response.json();
      const settings = payload?.data ?? payload;

      if (settings?.b2b) {
        setB2bSettings({
          showPrices: settings.b2b.showPrices !== false,
          showStock: settings.b2b.showStock !== false,
          catalogVisibility: settings.b2b.catalogVisibility || 'public',
        });
      }
    } catch (err) {
      console.error('Failed to fetch B2B settings:', err);
    }
  };

  const handleAddToCart = (product: Product) => {
    addItem(
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        currency: product.currency,
        image_url: product.image_url,
      },
      1,
    );

    // Show success feedback
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 2000);
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = {
        page: 1,
        limit: 100,
        search: searchQuery || undefined,
        category: selectedCategory !== 'Toate Produsele' ? selectedCategory : undefined,
        kelvin: selectedKelvin.length > 0 ? selectedKelvin : undefined,
        ip: selectedIp.length > 0 ? selectedIp : undefined,
        min_price: priceMin ? parseFloat(priceMin) : undefined,
        max_price: priceMax ? parseFloat(priceMax) : undefined,
        sort: sortBy,
        stock: stockFilter !== 'all' ? stockFilter : undefined,
      };

      let response: any;
      if (isAuthenticated) {
        response = await b2bApi.getProducts(params);
        setProducts(response.products || []);
      } else {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value === undefined || value === null || value === '') {
            return;
          }

          if (Array.isArray(value)) {
            value.forEach((item) => queryParams.append(key, String(item)));
            return;
          }

          queryParams.append(key, String(value));
        });

        const response = await fetch(`/api/v1/b2b/products?${queryParams.toString()}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const payload = await response.json();
        const data = payload?.data ?? payload;
        setProducts(data.products || []);
      }
    } catch (err) {
      console.error('Failed to fetch products:', err);
      setError('Nu s-a putut încărca catalogul.');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)),
      );
    }

    // Category
    if (selectedCategory !== 'Toate Produsele') {
      filtered = filtered.filter((p) =>
        p.category?.toLowerCase().includes(selectedCategory.toLowerCase()),
      );
    }

    // Stock
    if (stockFilter === 'local') {
      filtered = filtered.filter((p) => p.stock_local > 0);
    } else if (stockFilter === 'supplier') {
      filtered = filtered.filter((p) => p.stock_supplier > 0);
    }

    // Price
    if (priceMin) filtered = filtered.filter((p) => p.price >= parseFloat(priceMin));
    if (priceMax) filtered = filtered.filter((p) => p.price <= parseFloat(priceMax));

    // Kelvin
    if (selectedKelvin.length > 0) {
      filtered = filtered.filter((p) => {
        const specs = parseSpecs(p);
        return specs.kelvin && selectedKelvin.includes(specs.kelvin);
      });
    }

    // IP
    if (selectedIp.length > 0) {
      filtered = filtered.filter((p) => {
        const specs = parseSpecs(p);
        return specs.ip && selectedIp.includes(specs.ip);
      });
    }

    // Sort
    switch (sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'name_asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        break;
    }

    return filtered;
  }, [
    products,
    searchQuery,
    selectedCategory,
    stockFilter,
    priceMin,
    priceMax,
    sortBy,
    selectedKelvin,
    selectedIp,
  ]);

  const toggleKelvin = (val: string) => {
    setSelectedKelvin((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const toggleIp = (val: string) => {
    setSelectedIp((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Toate Produsele');
    setSelectedKelvin([]);
    setSelectedIp([]);
    setPriceMin('');
    setPriceMax('');
    setStockFilter('all');
  };

  // Check catalog visibility
  if (b2bSettings.catalogVisibility === 'hidden') {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0a0a0f' }}
      >
        <div className="text-center max-w-md p-8">
          <Package size={64} className="mx-auto mb-6" style={{ color: '#daa520' }} />
          <h2 className="text-2xl font-bold text-white mb-3">Catalog Temporar Indisponibil</h2>
          <p className="text-gray-400 mb-6">
            Catalogul nostru este momentan în mentenanță. Vă rugăm reveniți în curând.
          </p>
          <Link
            to="/b2b-store"
            className="inline-block px-6 py-3 rounded-lg font-medium"
            style={{ background: '#daa520', color: '#000' }}
          >
            Înapoi la Pagina Principală
          </Link>
        </div>
      </div>
    );
  }

  if (b2bSettings.catalogVisibility === 'login_only') {
    if (!isAuthenticated) {
      return (
        <div
          className="min-h-screen flex items-center justify-center"
          style={{ background: '#0a0a0f' }}
        >
          <div className="text-center max-w-md p-8">
            <Shield size={64} className="mx-auto mb-6" style={{ color: '#daa520' }} />
            <h2 className="text-2xl font-bold text-white mb-3">Acces Restricționat</h2>
            <p className="text-gray-400 mb-6">
              Catalogul este disponibil doar pentru clienții autentificați. Vă rugăm
              autentificați-vă pentru a vedea produsele.
            </p>
            <div className="flex gap-3 justify-center">
              <Link
                to={`/b2b-store/login?redirect=${encodeURIComponent(location.pathname)}`}
                className="inline-block px-6 py-3 rounded-lg font-medium"
                style={{ background: '#daa520', color: '#000' }}
              >
                Autentificare
              </Link>
              <Link
                to="/b2b-store/register"
                className="inline-block px-6 py-3 rounded-lg font-medium border"
                style={{ borderColor: '#daa520', color: '#daa520' }}
              >
                Înregistrare
              </Link>
            </div>
          </div>
        </div>
      );
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0a0a0f' }}
      >
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={40} style={{ color: '#daa520' }} />
          <p style={{ color: '#666' }}>Se încarcă catalogul...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
      {/* Header */}
      <div
        className="py-10"
        style={{
          borderBottom: '1px solid rgba(218,165,32,0.1)',
          background: 'linear-gradient(180deg, rgba(218,165,32,0.04) 0%, rgba(10,10,15,1) 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Catalog Produse</h1>
              <p className="text-sm mt-1" style={{ color: '#666' }}>
                {filteredProducts.length} produse disponibile
              </p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="relative flex-grow md:w-80">
                <input
                  type="text"
                  placeholder="Caută produse, SKU-uri..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                  }}
                />
                <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: '#555' }} />
              </div>
              {/* Filter Toggle (Mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="md:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: 'rgba(218,165,32,0.1)',
                  border: '1px solid rgba(218,165,32,0.2)',
                  color: '#daa520',
                }}
              >
                <SlidersHorizontal size={16} /> Filtre
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* ========== SIDEBAR FILTERS ========== */}
          <aside
            className={`w-72 flex-shrink-0 space-y-6 ${showFilters ? 'block' : 'hidden'} md:block`}
          >
            {/* Categories */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
                <Package size={14} style={{ color: '#daa520' }} />
                Categorii
              </h3>
              <div className="space-y-1">
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      color: selectedCategory === cat ? '#daa520' : '#888',
                      background:
                        selectedCategory === cat ? 'rgba(218,165,32,0.08)' : 'transparent',
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Temperature */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
                <Thermometer size={14} style={{ color: '#daa520' }} />
                Temperatură Culoare
              </h3>
              <div className="space-y-2">
                {availableFilters.kelvin.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedKelvin.includes(opt.value)}
                      onChange={() => toggleKelvin(opt.value)}
                      className="rounded"
                      style={{ accentColor: '#daa520' }}
                    />
                    <span className="text-sm" style={{ color: '#888' }}>
                      {opt.label}
                    </span>
                    <span
                      className="ml-auto w-4 h-4 rounded-full border"
                      style={{
                        background:
                          opt.value === '3000'
                            ? '#ffb347'
                            : opt.value === '4000'
                              ? '#fff5e6'
                              : '#e8f4ff',
                        borderColor: 'rgba(255,255,255,0.1)',
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* IP Rating */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <h3 className="font-semibold text-white text-sm mb-4 flex items-center gap-2">
                <Droplets size={14} style={{ color: '#daa520' }} />
                Grad Protecție (IP)
              </h3>
              <div className="space-y-2">
                {availableFilters.ip.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIp.includes(opt.value)}
                      onChange={() => toggleIp(opt.value)}
                      className="rounded"
                      style={{ accentColor: '#daa520' }}
                    />
                    <span className="text-sm" style={{ color: '#888' }}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <h3 className="font-semibold text-white text-sm mb-4">Preț (RON)</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                  }}
                />
                <span style={{ color: '#555' }}>—</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                  }}
                />
              </div>
            </div>

            {/* Stock Filter */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <h3 className="font-semibold text-white text-sm mb-4">Disponibilitate</h3>
              <div className="space-y-2">
                {[
                  { label: 'Toate', value: 'all' as const },
                  { label: 'Stoc Local', value: 'local' as const },
                  { label: 'Stoc Furnizor', value: 'supplier' as const },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStockFilter(opt.value)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      color: stockFilter === opt.value ? '#daa520' : '#888',
                      background:
                        stockFilter === opt.value ? 'rgba(218,165,32,0.08)' : 'transparent',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear Filters */}
            <button
              onClick={clearFilters}
              className="w-full text-center py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{
                color: '#daa520',
                border: '1px solid rgba(218,165,32,0.2)',
                background: 'transparent',
              }}
            >
              Resetează Filtrele
            </button>
          </aside>

          {/* ========== PRODUCT GRID ========== */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    color: viewMode === 'grid' ? '#daa520' : '#555',
                    background: viewMode === 'grid' ? 'rgba(218,165,32,0.08)' : 'transparent',
                  }}
                >
                  <Grid3X3 size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    color: viewMode === 'list' ? '#daa520' : '#555',
                    background: viewMode === 'list' ? 'rgba(218,165,32,0.08)' : 'transparent',
                  }}
                >
                  <List size={18} />
                </button>
              </div>
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none px-4 py-2 pr-8 rounded-xl text-sm focus:outline-none cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#aaa',
                  }}
                >
                  {sortOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-3 pointer-events-none"
                  style={{ color: '#555' }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-center py-16">
                <p style={{ color: '#ef4444' }}>{error}</p>
                <Button
                  onClick={fetchProducts}
                  className="mt-4"
                  style={{ background: '#daa520', color: '#000' }}
                >
                  Reîncearcă
                </Button>
              </div>
            )}

            {/* No Results */}
            {!error && filteredProducts.length === 0 && (
              <div className="text-center py-20">
                <Package size={48} className="mx-auto mb-4" style={{ color: '#333' }} />
                <p className="text-lg font-medium text-white mb-2">Niciun produs găsit</p>
                <p className="text-sm mb-4" style={{ color: '#666' }}>
                  Încercați alte criterii de căutare.
                </p>
                <button
                  onClick={clearFilters}
                  className="text-sm font-medium"
                  style={{ color: '#daa520' }}
                >
                  Resetează filtrele
                </button>
              </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProducts.map((product) => {
                  const specs = parseSpecs(product);
                  return (
                    <div
                      key={product.id}
                      className="rounded-2xl overflow-hidden group transition-all duration-300 hover:-translate-y-1"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(218,165,32,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                      }}
                    >
                      {/* Image */}
                      <div
                        className="relative h-52 overflow-hidden"
                        style={{ background: '#111118' }}
                      >
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={40} style={{ color: '#222' }} />
                          </div>
                        )}
                        {/* Quick View Overlay */}
                        <div
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                          style={{ background: 'rgba(0,0,0,0.5)' }}
                        >
                          <button
                            onClick={() => setQuickViewProduct(product)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium text-black"
                            style={{ background: 'linear-gradient(135deg, #daa520, #ffd700)' }}
                          >
                            <Eye size={14} /> Vizualizare Rapidă
                          </button>
                        </div>
                        {/* Stock badge */}
                        {b2bSettings.showStock && product.stock_local > 0 && (
                          <div
                            className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide"
                            style={{ background: 'rgba(16, 185, 129, 0.9)', color: '#fff' }}
                          >
                            Stoc Local
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-5">
                        <p
                          className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                          style={{ color: '#daa520' }}
                        >
                          {product.category || 'LED'}
                        </p>
                        <Link to={`/b2b-store/product/${product.id}`}>
                          <h3
                            className="font-bold text-white mb-1 line-clamp-2 hover:underline cursor-pointer leading-snug"
                            title={product.name}
                          >
                            {product.name}
                          </h3>
                        </Link>
                        <p className="text-xs mb-3" style={{ color: '#555' }}>
                          SKU: {product.sku}
                        </p>

                        {/* Spec Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {specs.watt && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: 'rgba(218,165,32,0.1)',
                                color: '#daa520',
                                border: '1px solid rgba(218,165,32,0.2)',
                              }}
                            >
                              ⚡ {specs.watt}
                            </span>
                          )}
                          {specs.kelvin && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: 'rgba(79,142,255,0.1)',
                                color: '#4f8eff',
                                border: '1px solid rgba(79,142,255,0.2)',
                              }}
                            >
                              🌡 {specs.kelvin}
                            </span>
                          )}
                          {specs.ip && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: 'rgba(16,185,129,0.1)',
                                color: '#10b981',
                                border: '1px solid rgba(16,185,129,0.2)',
                              }}
                            >
                              💧 {specs.ip}
                            </span>
                          )}
                          {specs.lumen && (
                            <span
                              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                              style={{
                                background: 'rgba(251,191,36,0.1)',
                                color: '#fbbf24',
                                border: '1px solid rgba(251,191,36,0.2)',
                              }}
                            >
                              💡 {specs.lumen}
                            </span>
                          )}
                        </div>

                        {/* Stock Status */}
                        {b2bSettings.showStock && (
                          <div className="mb-4 flex flex-col gap-1 text-xs">
                            {product.stock_local > 0 ? (
                              <span
                                className="flex items-center gap-1.5"
                                style={{ color: '#10b981' }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: '#10b981' }}
                                />
                                Stoc Local: {product.stock_local} buc
                              </span>
                            ) : (
                              <span
                                className="flex items-center gap-1.5"
                                style={{ color: '#ef4444' }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: '#ef4444' }}
                                />
                                Fără stoc local
                              </span>
                            )}
                            {product.stock_supplier > 0 && (
                              <span
                                className="flex items-center gap-1.5"
                                style={{ color: '#4f8eff' }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: '#4f8eff' }}
                                />
                                Furnizor: {product.stock_supplier} buc ({product.supplier_lead_time}{' '}
                                zile)
                              </span>
                            )}
                          </div>
                        )}

                        {/* Price + Cart */}
                        <div
                          className="flex items-center justify-between pt-4"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          {b2bSettings.showPrices ? (
                            <div>
                              <div className="text-xl font-bold" style={{ color: '#daa520' }}>
                                {product.price.toFixed(2)}{' '}
                                <span className="text-xs font-normal" style={{ color: '#666' }}>
                                  {product.currency}
                                </span>
                              </div>
                              <div className="text-[10px]" style={{ color: '#555' }}>
                                fără TVA
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm" style={{ color: '#666' }}>
                              Autentifică-te pentru preț
                            </div>
                          )}
                          <button
                            onClick={() => handleAddToCart(product)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                            style={{
                              background:
                                addedToCart === product.id
                                  ? 'linear-gradient(135deg, #10b981, #059669)'
                                  : 'linear-gradient(135deg, #daa520, #b8860b)',
                              color: '#000',
                            }}
                            title="Adaugă în coș"
                          >
                            {addedToCart === product.id ? (
                              <CheckCircle size={16} />
                            ) : (
                              <ShoppingCart size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {filteredProducts.map((product) => {
                  const specs = parseSpecs(product);
                  return (
                    <div
                      key={product.id}
                      className="rounded-2xl overflow-hidden flex transition-all duration-300"
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(218,165,32,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                      }}
                    >
                      {/* Image */}
                      <div
                        className="w-36 h-36 md:w-48 md:h-auto flex-shrink-0"
                        style={{ background: '#111118' }}
                      >
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Zap size={32} style={{ color: '#222' }} />
                          </div>
                        )}
                      </div>
                      {/* Content */}
                      <div className="flex-1 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                            style={{ color: '#daa520' }}
                          >
                            {product.category || 'LED'} · {product.sku}
                          </p>
                          <Link to={`/b2b-store/product/${product.id}`}>
                            <h3 className="font-bold text-white mb-2 hover:underline">
                              {product.name}
                            </h3>
                          </Link>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {specs.watt && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ background: 'rgba(218,165,32,0.1)', color: '#daa520' }}
                              >
                                ⚡ {specs.watt}
                              </span>
                            )}
                            {specs.kelvin && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ background: 'rgba(79,142,255,0.1)', color: '#4f8eff' }}
                              >
                                🌡 {specs.kelvin}
                              </span>
                            )}
                            {specs.ip && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}
                              >
                                💧 {specs.ip}
                              </span>
                            )}
                            {specs.lumen && (
                              <span
                                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                                style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
                              >
                                💡 {specs.lumen}
                              </span>
                            )}
                          </div>
                          {b2bSettings.showStock && (
                            <div className="flex gap-4 text-xs">
                              {product.stock_local > 0 && (
                                <span style={{ color: '#10b981' }}>
                                  ● Stoc Local: {product.stock_local}
                                </span>
                              )}
                              {product.stock_supplier > 0 && (
                                <span style={{ color: '#4f8eff' }}>
                                  ● Furnizor: {product.stock_supplier} ({product.supplier_lead_time}
                                  z)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          {b2bSettings.showPrices ? (
                            <div className="text-right">
                              <div className="text-xl font-bold" style={{ color: '#daa520' }}>
                                {product.price.toFixed(2)} {product.currency}
                              </div>
                              <div className="text-[10px]" style={{ color: '#555' }}>
                                fără TVA
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-right" style={{ color: '#666' }}>
                              Autentifică-te
                              <br />
                              pentru preț
                            </div>
                          )}
                          <button
                            onClick={() => handleAddToCart(product)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:scale-105"
                            style={{
                              background:
                                addedToCart === product.id
                                  ? 'linear-gradient(135deg, #10b981, #059669)'
                                  : 'linear-gradient(135deg, #daa520, #b8860b)',
                              color: '#000',
                            }}
                          >
                            {addedToCart === product.id ? (
                              <CheckCircle size={16} />
                            ) : (
                              <ShoppingCart size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination */}
            {filteredProducts.length > 0 && (
              <div className="mt-10 flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-full px-8"
                  style={{ borderColor: 'rgba(218,165,32,0.2)', color: '#daa520' }}
                >
                  Încarcă Mai Multe
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== QUICK VIEW MODAL ========== */}
      {quickViewProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setQuickViewProduct(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl overflow-hidden"
            style={{
              background: '#12121a',
              border: '1px solid rgba(218,165,32,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row">
              {/* Image */}
              <div className="w-full md:w-1/2 h-64 md:h-auto" style={{ background: '#111118' }}>
                {quickViewProduct.image_url ? (
                  <img
                    src={quickViewProduct.image_url}
                    alt={quickViewProduct.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Zap size={60} style={{ color: '#222' }} />
                  </div>
                )}
              </div>
              {/* Details */}
              <div className="flex-1 p-7">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                      style={{ color: '#daa520' }}
                    >
                      {quickViewProduct.category || 'LED'}
                    </p>
                    <h2 className="text-2xl font-bold text-white">{quickViewProduct.name}</h2>
                    <p className="text-xs mt-1" style={{ color: '#555' }}>
                      SKU: {quickViewProduct.sku}
                    </p>
                  </div>
                  <button
                    onClick={() => setQuickViewProduct(null)}
                    className="p-1.5 rounded-lg"
                    style={{ color: '#666' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <p className="text-sm mb-6 leading-relaxed" style={{ color: '#777' }}>
                  {quickViewProduct.description || 'Produs de iluminat LED de înaltă calitate.'}
                </p>

                {/* Specs */}
                {(() => {
                  const specs = parseSpecs(quickViewProduct);
                  return (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {specs.watt && (
                        <span
                          className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background: 'rgba(218,165,32,0.1)',
                            color: '#daa520',
                            border: '1px solid rgba(218,165,32,0.2)',
                          }}
                        >
                          ⚡ {specs.watt}
                        </span>
                      )}
                      {specs.kelvin && (
                        <span
                          className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background: 'rgba(79,142,255,0.1)',
                            color: '#4f8eff',
                            border: '1px solid rgba(79,142,255,0.2)',
                          }}
                        >
                          🌡 {specs.kelvin}
                        </span>
                      )}
                      {specs.ip && (
                        <span
                          className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background: 'rgba(16,185,129,0.1)',
                            color: '#10b981',
                            border: '1px solid rgba(16,185,129,0.2)',
                          }}
                        >
                          💧 {specs.ip}
                        </span>
                      )}
                      {specs.lumen && (
                        <span
                          className="px-3 py-1 rounded-full text-xs font-semibold"
                          style={{
                            background: 'rgba(251,191,36,0.1)',
                            color: '#fbbf24',
                            border: '1px solid rgba(251,191,36,0.2)',
                          }}
                        >
                          💡 {specs.lumen}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Stock */}
                {b2bSettings.showStock && (
                  <div className="mb-6 space-y-1.5 text-sm">
                    {quickViewProduct.stock_local > 0 ? (
                      <span className="flex items-center gap-2" style={{ color: '#10b981' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: '#10b981' }} />
                        Stoc Local: {quickViewProduct.stock_local} buc — Livrare 24h
                      </span>
                    ) : (
                      <span className="flex items-center gap-2" style={{ color: '#ef4444' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                        Fără stoc local
                      </span>
                    )}
                    {quickViewProduct.stock_supplier > 0 && (
                      <span className="flex items-center gap-2" style={{ color: '#4f8eff' }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: '#4f8eff' }} />
                        Furnizor: {quickViewProduct.stock_supplier} buc (
                        {quickViewProduct.supplier_lead_time} zile)
                      </span>
                    )}
                  </div>
                )}

                {/* Price */}
                {b2bSettings.showPrices ? (
                  <div
                    className="mb-6 pb-6"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="text-3xl font-bold" style={{ color: '#daa520' }}>
                      {quickViewProduct.price.toFixed(2)}{' '}
                      <span className="text-sm font-normal" style={{ color: '#666' }}>
                        {quickViewProduct.currency} fără TVA
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    className="mb-6 pb-6"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    <div className="text-lg" style={{ color: '#666' }}>
                      Autentifică-te pentru a vedea prețul
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <Link to={`/b2b-store/product/${quickViewProduct.id}`} className="flex-1">
                    <Button
                      variant="outline"
                      className="w-full rounded-xl"
                      style={{ borderColor: 'rgba(218,165,32,0.2)', color: '#daa520' }}
                    >
                      Vezi Detalii Complete
                    </Button>
                  </Link>
                  <Button
                    onClick={() => {
                      if (quickViewProduct) {
                        handleAddToCart(quickViewProduct);
                        setTimeout(() => setQuickViewProduct(null), 1500);
                      }
                    }}
                    className="flex-1 rounded-xl text-black font-semibold"
                    style={{
                      background:
                        quickViewProduct && addedToCart === quickViewProduct.id
                          ? 'linear-gradient(135deg, #10b981, #059669)'
                          : 'linear-gradient(135deg, #daa520, #b8860b)',
                    }}
                  >
                    {quickViewProduct && addedToCart === quickViewProduct.id ? (
                      <>
                        <CheckCircle size={16} className="mr-2" />
                        Adăugat în Coș!
                      </>
                    ) : (
                      <>
                        <ShoppingCart size={16} className="mr-2" />
                        Adaugă în Coș
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
