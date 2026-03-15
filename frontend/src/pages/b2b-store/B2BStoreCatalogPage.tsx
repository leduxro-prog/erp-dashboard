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
  technical?: {
    wattage?: number;
    kelvin?: number;
    ipRating?: string;
    lumens?: number;
  };
}

// Specs parser - extract lighting specs from product name/description
const parseSpecs = (product: Product) => {
  if (product.technical) {
    return {
      watt: product.technical.wattage ? `${product.technical.wattage}W` : null,
      kelvin: product.technical.kelvin ? product.technical.kelvin.toString() : null,
      ip: product.technical.ipRating || null,
      lumen: product.technical.lumens ? `${product.technical.lumens}lm` : null,
    };
  }

  const text = `${product.name} ${product.description}`.toLowerCase();
  const wattMatch = text.match(/(\d+)\s*w(?:att)?/i);
  const kelvinMatch = text.match(/(\d{4})\s*k/i);
  const ipMatch = text.match(/ip\s*(\d{2,3})/i);
  const lumenMatch = text.match(/(\d+)\s*(?:lm|lumen)/i);
  return {
    watt: wattMatch ? `${wattMatch[1]}W` : null,
    kelvin: kelvinMatch ? kelvinMatch[1] : null,
    ip: ipMatch ? `IP${ipMatch[1]}` : null,
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
  const [compareList, setCompareList] = useState<number[]>([]);

  // B2B Rules
  const [b2bSettings, setB2bSettings] = useState({
    showPrices: true,
    showStock: true,
    catalogVisibility: 'public' as 'public' | 'login_only' | 'hidden',
  });

  // Dynamic Filters
  const [availableCategories, setAvailableCategories] = useState<string[]>(lightingCategories);
  const [availableFilters, setAvailableFilters] = useState<{ kelvin: any[]; ip: any[] }>({
    kelvin: kelvinOptions,
    ip: ipOptions,
  });

  // Pagination
  const [page, setPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 24;

  const { addItem } = useCartStore();
  const { isAuthenticated } = useB2BAuthStore();
  const location = useLocation();

  const fetchB2BSettings = async () => {
    try {
      const response = await fetch('/api/v1/settings', { credentials: 'include' });
      if (!response.ok) return;
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
    }
  };

  const fetchProducts = async (isInitial = false) => {
    try {
      setLoading(true);
      const currentPage = isInitial ? 1 : page;
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        search: searchQuery || undefined,
        category: selectedCategory !== 'Toate Produsele' ? selectedCategory : undefined,
        kelvin: selectedKelvin.length > 0 ? selectedKelvin : undefined,
        ip: selectedIp.length > 0 ? selectedIp : undefined,
        min_price: priceMin ? parseFloat(priceMin) : undefined,
        max_price: priceMax ? parseFloat(priceMax) : undefined,
        sort: sortBy,
        stock: stockFilter !== 'all' ? stockFilter : undefined,
      };

      let fetchedItems: Product[] = [];
      let total = 0;

      if (isAuthenticated) {
        const response = await b2bApi.getProducts(params);
        fetchedItems = response.products || [];
        total = response.total || 0;
      } else {
        const queryParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (!value) return;
          if (Array.isArray(value)) {
            value.forEach((v) => queryParams.append(key, String(v)));
            return;
          }
          queryParams.append(key, String(value));
        });

        const response = await fetch(`/api/v1/b2b/products?${queryParams.toString()}`, { credentials: 'include' });
        if (!response.ok) throw new Error('Failed to fetch');
        const payload = await response.json();
        const data = payload?.data ?? payload;
        fetchedItems = data.products || [];
        total = data.total || 0;
      }

      if (isInitial) {
        setProducts(fetchedItems);
      } else {
        setProducts(prev => [...prev, ...fetchedItems]);
      }
      
      setTotalProducts(total);
      setHasMore((isInitial ? 0 : products.length) + fetchedItems.length < total);

    } catch (err) {
      console.error('Error fetching catalog:', err);
      setError('S-a produs o eroare la încărcarea catalogului.');
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setPage(prev => prev + 1);
    }
  };

  const handleAddToCart = (product: Product) => {
    addItem({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      currency: product.currency,
      image_url: product.image_url,
    }, 1);
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 2000);
  };

  const toggleCompare = (id: number) => {
    setCompareList(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleKelvin = (val: string) => {
    setSelectedKelvin(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const toggleIp = (val: string) => {
    setSelectedIp(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Toate Produsele');
    setSelectedKelvin([]);
    setSelectedIp([]);
    setPriceMin('');
    setPriceMax('');
    setStockFilter('all');
    setPage(1);
  };

  // Effects
  useEffect(() => {
    fetchB2BSettings();
    loadFilters();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, selectedKelvin, selectedIp, priceMin, priceMax, sortBy, stockFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(page === 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [page, searchQuery, selectedCategory, selectedKelvin, selectedIp, priceMin, priceMax, sortBy, stockFilter, isAuthenticated]);

  const filteredProducts = products; // Using products directly as they are filtered by API

  // Visibility Guards
  if (b2bSettings.catalogVisibility === 'hidden') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center p-8">
          <Package size={64} className="mx-auto mb-6 text-primary-500" />
          <h2 className="text-2xl font-bold text-white mb-3">Catalog Temporar Indisponibil</h2>
          <p className="text-gray-400 mb-6">Mentenanță în curs. Reveniți în curând.</p>
          <Link to="/b2b-store" className="bg-primary-500 text-black px-8 py-3 rounded-xl font-bold">Acasă</Link>
        </div>
      </div>
    );
  }

  if (b2bSettings.catalogVisibility === 'login_only' && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center p-8 max-w-md">
          <Shield size={64} className="mx-auto mb-6 text-primary-500" />
          <h2 className="text-2xl font-bold text-white mb-3">Acces Restricționat</h2>
          <p className="text-gray-400 mb-8">Autentificați-vă pentru a accesa catalogul profesional Ledux.</p>
          <div className="flex gap-4">
            <Link to="/b2b-store/login" className="flex-1 bg-primary-500 text-black py-3 rounded-xl font-bold">Login</Link>
            <Link to="/b2b-store/register" className="flex-1 border border-primary-500 text-primary-500 py-3 rounded-xl font-bold">Cont Nou</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a0f] min-h-screen pb-20">
      {/* Catalog Header */}
      <div className="py-12 border-b border-white/5 bg-gradient-to-b from-primary-500/5 to-transparent">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold text-white">Catalog B2B</h1>
              <p className="text-gray-500 mt-2">Peste {totalProducts} repere profesionale în timp real</p>
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input 
                  type="text" 
                  placeholder="Caută după denumire sau SKU..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:border-primary-500 outline-none transition-all"
                />
              </div>
              <button onClick={() => setShowFilters(!showFilters)} className="md:hidden bg-primary-500/10 border border-primary-500/20 text-primary-500 p-3 rounded-2xl">
                <SlidersHorizontal size={24} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="flex gap-10">
          {/* Filters Sidebar */}
          <aside className={`w-72 flex-shrink-0 space-y-8 ${showFilters ? 'fixed inset-0 z-50 bg-[#0a0a0f] p-6 overflow-y-auto' : 'hidden md:block'}`}>
            {showFilters && (
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Filtre</h3>
                <button onClick={() => setShowFilters(false)} className="text-white"><X /></button>
              </div>
            )}
            
            <div>
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Package size={14} className="text-primary-500" /> Categorii
              </h4>
              <div className="space-y-1">
                {availableCategories.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-all ${selectedCategory === cat ? 'bg-primary-500/10 text-primary-500 font-bold' : 'text-gray-400 hover:text-white'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-3xl bg-white/2 border border-white/5 space-y-6">
              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Thermometer size={14} className="text-primary-500" /> Kelvin
                </h4>
                <div className="space-y-2">
                  {availableFilters.kelvin.map(opt => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer group">
                      <input type="checkbox" checked={selectedKelvin.includes(opt.value)} onChange={() => toggleKelvin(opt.value)} className="hidden" />
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selectedKelvin.includes(opt.value) ? 'bg-primary-500 border-primary-500' : 'border-white/20'}`}>
                        {selectedKelvin.includes(opt.value) && <CheckCircle size={12} className="text-black" />}
                      </div>
                      <span className="text-sm text-gray-400 group-hover:text-white">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Droplets size={14} className="text-primary-500" /> Protecție IP
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {availableFilters.ip.map(opt => (
                    <button 
                      key={opt.value} 
                      onClick={() => toggleIp(opt.value)}
                      className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${selectedIp.includes(opt.value) ? 'bg-primary-500 border-primary-500 text-black' : 'border-white/10 text-gray-400'}`}
                    >
                      {opt.value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={clearFilters} className="w-full py-4 rounded-2xl border border-white/10 text-gray-400 text-sm font-bold hover:bg-white/5 transition-all">
              Resetează Toate
            </button>
          </aside>

          {/* Main Grid */}
          <main className="flex-1">
            {/* Controls */}
            <div className="flex justify-between items-center mb-8">
              <div className="flex bg-white/5 p-1 rounded-xl">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-primary-500 text-black shadow-lg' : 'text-gray-500'}`}><Grid3X3 size={20}/></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-primary-500 text-black shadow-lg' : 'text-gray-500'}`}><List size={20}/></button>
              </div>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none"
              >
                {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {loading && products.length === 0 ? (
              <div className="py-20 text-center">
                <Loader className="animate-spin mx-auto text-primary-500 mb-4" size={48} />
                <p className="text-gray-500">Se încarcă produsele...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="py-20 text-center bg-white/2 rounded-3xl border border-dashed border-white/10">
                <Package size={48} className="mx-auto text-gray-700 mb-4" />
                <p className="text-white font-bold">Niciun produs găsit</p>
                <button onClick={clearFilters} className="text-primary-500 text-sm mt-2">Vezi toate produsele</button>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                {products.map(product => {
                  const specs = parseSpecs(product);
                  return (
                    <div 
                      key={product.id} 
                      className={`group bg-white/2 border border-white/5 rounded-3xl overflow-hidden hover:border-primary-500/30 transition-all ${viewMode === 'list' ? 'flex' : ''}`}
                    >
                      <div className={`relative bg-white/5 overflow-hidden ${viewMode === 'list' ? 'w-48 h-48 flex-shrink-0' : 'h-64'}`}>
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/10"><Zap size={48} /></div>
                        )}
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => setQuickViewProduct(product)} className="bg-white text-black px-6 py-2 rounded-full text-xs font-bold">Rapid</button>
                          <button onClick={() => toggleCompare(product.id)} className="border border-white/30 text-white px-6 py-2 rounded-full text-xs font-bold backdrop-blur-sm">
                            {compareList.includes(product.id) ? '✓ Compară' : '+ Compară'}
                          </button>
                        </div>
                      </div>

                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-primary-500 uppercase tracking-widest">{product.category || 'LED'}</span>
                          <Link to={`/b2b-store/product/${product.id}`}>
                            <h3 className="text-white font-bold mt-1 line-clamp-2 hover:text-primary-500 transition-colors" title={product.name}>{product.name}</h3>
                          </Link>
                          <p className="text-xs text-gray-600 mt-1 font-mono">SKU: {product.sku}</p>
                          
                          <div className="flex flex-wrap gap-2 mt-4">
                            {specs.watt && <span className="px-2 py-1 bg-white/5 rounded-lg text-[10px] text-gray-400 font-bold border border-white/5">⚡ {specs.watt}</span>}
                            {specs.kelvin && <span className="px-2 py-1 bg-white/5 rounded-lg text-[10px] text-gray-400 font-bold border border-white/5">🌡 {specs.kelvin}K</span>}
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                          <div>
                            {b2bSettings.showPrices ? (
                              <>
                                <span className="text-2xl font-black text-primary-500">{product.price.toFixed(2)}</span>
                                <span className="text-xs text-gray-600 ml-1">{product.currency}</span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-600">Login pt preț</span>
                            )}
                          </div>
                          <button 
                            onClick={() => handleAddToCart(product)}
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${addedToCart === product.id ? 'bg-green-500 text-white' : 'bg-primary-500 text-black hover:scale-110'}`}
                          >
                            {addedToCart === product.id ? <CheckCircle size={20}/> : <ShoppingCart size={20}/>}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {hasMore && products.length > 0 && (
              <div className="mt-12 text-center">
                <Button 
                  onClick={handleLoadMore} 
                  disabled={loading}
                  className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-10 h-14 rounded-2xl font-bold"
                >
                  {loading ? <Loader className="animate-spin" /> : `Încarcă mai multe (afișat ${products.length} din ${totalProducts})`}
                </Button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Compare Bar */}
      {compareList.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom duration-500">
          <div className="bg-[#12121a]/95 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl flex items-center gap-10">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-primary-500 rounded-2xl flex items-center justify-center text-black font-black">{compareList.length}</div>
              <p className="text-white font-bold">Produse pentru comparat</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setCompareList([])} className="text-gray-500 hover:text-white font-bold px-4">Reset</button>
              <button className="bg-primary-500 text-black px-8 py-3 rounded-2xl font-black shadow-lg shadow-primary-500/20">Compară Acum</button>
            </div>
          </div>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90" onClick={() => setQuickViewProduct(null)}>
          <div className="bg-[#12121a] border border-white/10 rounded-[40px] max-w-5xl w-full overflow-hidden flex flex-col md:flex-row shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="md:w-1/2 h-96 md:h-auto bg-white/2">
              {quickViewProduct.image_url ? (
                <img src={quickViewProduct.image_url} alt={quickViewProduct.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/5"><Zap size={100} /></div>
              )}
            </div>
            <div className="flex-1 p-12">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <span className="text-xs font-bold text-primary-500 uppercase tracking-widest">{quickViewProduct.category}</span>
                  <h2 className="text-3xl font-black text-white mt-2">{quickViewProduct.name}</h2>
                  <p className="text-gray-600 mt-2 font-mono uppercase tracking-tighter">{quickViewProduct.sku}</p>
                </div>
                <button onClick={() => setQuickViewProduct(null)} className="p-3 bg-white/5 rounded-2xl text-gray-500 hover:text-white"><X/></button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-10">
                {(() => {
                  const specs = parseSpecs(quickViewProduct);
                  return (
                    <>
                      {specs.watt && <div className="bg-white/2 p-4 rounded-3xl border border-white/5 text-center"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Putere</p><p className="text-white font-bold">{specs.watt}</p></div>}
                      {specs.kelvin && <div className="bg-white/2 p-4 rounded-3xl border border-white/5 text-center"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Culoare</p><p className="text-white font-bold">{specs.kelvin}K</p></div>}
                      {specs.ip && <div className="bg-white/2 p-4 rounded-3xl border border-white/5 text-center"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Protecție</p><p className="text-white font-bold">{specs.ip}</p></div>}
                      {specs.lumen && <div className="bg-white/2 p-4 rounded-3xl border border-white/5 text-center"><p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Lumeni</p><p className="text-white font-bold">{specs.lumen}</p></div>}
                    </>
                  );
                })()}
              </div>

              <div className="flex items-center justify-between mb-8">
                {b2bSettings.showPrices ? (
                  <div>
                    <span className="text-4xl font-black text-white">{quickViewProduct.price.toFixed(2)}</span>
                    <span className="text-lg text-gray-500 ml-2">{quickViewProduct.currency}</span>
                  </div>
                ) : (
                  <p className="text-gray-500">Autentifică-te pentru preț</p>
                )}
                <button onClick={() => handleAddToCart(quickViewProduct)} className="bg-primary-500 text-black px-10 py-4 rounded-2xl font-black shadow-lg shadow-primary-500/20">Adaugă în Coș</button>
              </div>
              
              <Link to={`/b2b-store/product/${quickViewProduct.id}`} onClick={() => setQuickViewProduct(null)} className="block text-center text-gray-500 hover:text-white font-bold py-2">Vezi detalii complete →</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
