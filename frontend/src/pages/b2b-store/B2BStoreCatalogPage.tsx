import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';
import { b2bApi } from '../../services/b2b-api';
import { useCartStore } from '../../stores/cart.store';
import { useB2BAuthStore } from '../../stores/b2b/b2b-auth.store';
import { trackAddToCart } from '../../services/retargeting';
import { resolveSupplierLeadTimeLabel } from '../../utils/supplierLeadTime';

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
  stock_total?: number;
  supplier_lead_time: number;
  supplier_lead_time_label?: string;
  supplier_name?: string | null;
  rating?: number;
  category?: string;
  brand?: string | null;
  manufacturer?: string | null;
  mounting_type?: string | null;
  ip_rating?: string | null;
  color_temperature?: number | null;
}

const getTotalStock = (product: Product): number => {
  return Number(product.stock_total ?? 0) || product.stock_local + product.stock_supplier;
};

const getSupplierStockDisplay = (
  product: Product,
): { label: string; color: string; dot: string } | null => {
  const leadTimeLabel = resolveSupplierLeadTimeLabel(
    product.supplier_name,
    product.supplier_lead_time,
    product.supplier_lead_time_label,
    product.brand,
    product.manufacturer,
  );
  const supplierName = String(product.supplier_name || '').toLowerCase();
  const isMplSupplier = supplierName.includes('mpl power');

  if (isMplSupplier) {
    const available = product.stock_supplier > 0;
    return {
      label: available
        ? `Furnizor: Disponibil (${leadTimeLabel} zile)`
        : 'Furnizor: Indisponibil',
      color: available ? '#4f8eff' : '#ef4444',
      dot: available ? '#4f8eff' : '#ef4444',
    };
  }

  if (product.stock_supplier <= 0) {
    return null;
  }

  return {
    label: `Furnizor: ${product.stock_supplier} buc (${leadTimeLabel} zile)`,
    color: '#4f8eff',
    dot: '#4f8eff',
  };
};

const getManufacturer = (product: Product): string | null => {
  const value =
    String(product.manufacturer || '').trim() ||
    String(product.brand || '').trim() ||
    String(product.supplier_name || '').trim();

  return value.length > 0 ? value : null;
};

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
  const PAGE_SIZE = 48;
  const AUTO_LOAD_ROOT_MARGIN = '280px';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Toate Produsele');
  const [selectedKelvin, setSelectedKelvin] = useState<string[]>([]);
  const [selectedIp, setSelectedIp] = useState<string[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string[]>([]);
  const [selectedMountingType, setSelectedMountingType] = useState<string[]>([]);
  const [selectedStripType, setSelectedStripType] = useState<string[]>([]);
  const [selectedLedVoltage, setSelectedLedVoltage] = useState<string[]>([]);
  const [selectedLightColor, setSelectedLightColor] = useState<string[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'stock' | 'local' | 'supplier'>('all');
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
  const [availableFilters, setAvailableFilters] = useState<{
    kelvin: any[];
    ip: any[];
    brand: any[];
    mountingType: any[];
    stripType: any[];
    ledVoltage: any[];
    lightColor: any[];
  }>({
    kelvin: kelvinOptions,
    ip: ipOptions,
    brand: [],
    mountingType: [],
    stripType: [],
    ledVoltage: [],
    lightColor: [],
  });

  const { addItem } = useCartStore();
  const { isAuthenticated } = useB2BAuthStore();
  const location = useLocation();
  const latestRequestIdRef = useRef(0);
  const activeRequestAbortRef = useRef<AbortController | null>(null);
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);
  const prefetchedProductIdsRef = useRef<Set<number>>(new Set());
  const preloadedLcpImageRef = useRef<string | null>(null);

  useEffect(() => {
    fetchB2BSettings();
    loadCategories();
  }, []);

  useEffect(() => {
    loadFilters(selectedCategory !== 'Toate Produsele' ? selectedCategory : undefined);
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      const cats = await b2bApi.getCategories();

      if (cats && Array.isArray(cats)) {
        const normalizedCategories = cats
          .map((cat) => {
            if (typeof cat === 'string') {
              return cat.trim();
            }

            if (cat && typeof cat === 'object' && 'name' in cat) {
              return String((cat as { name?: unknown }).name || '').trim();
            }

            return '';
          })
          .filter((name) => name.length > 0);

        setAvailableCategories(['Toate Produsele', ...normalizedCategories]);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const loadFilters = async (category?: string) => {
    try {
      const filters = await b2bApi.getFilters({ category });

      if (!filters) {
        return;
      }

      setAvailableFilters({
        kelvin: Array.isArray(filters.kelvin) && filters.kelvin.length > 0 ? filters.kelvin : [],
        ip: Array.isArray(filters.ip) && filters.ip.length > 0 ? filters.ip : [],
        brand: Array.isArray(filters.brand) ? filters.brand : [],
        mountingType: Array.isArray(filters.mountingType) ? filters.mountingType : [],
        stripType: Array.isArray(filters.stripType) ? filters.stripType : [],
        ledVoltage: Array.isArray(filters.ledVoltage) ? filters.ledVoltage : [],
        lightColor: Array.isArray(filters.lightColor) ? filters.lightColor : [],
      });

      setSelectedKelvin((prev) =>
        prev.filter((value) =>
          (Array.isArray(filters.kelvin) ? filters.kelvin : []).some(
            (opt: any) => String(opt.value) === value,
          ),
        ),
      );
      setSelectedIp((prev) =>
        prev.filter((value) =>
          (Array.isArray(filters.ip) ? filters.ip : []).some(
            (opt: any) => String(opt.value).toUpperCase() === value.toUpperCase(),
          ),
        ),
      );
      setSelectedBrand((prev) =>
        prev.filter((value) =>
          (Array.isArray(filters.brand) ? filters.brand : []).some(
            (opt: any) => String(opt.value) === value,
          ),
        ),
      );
      setSelectedMountingType((prev) =>
        prev.filter((value) =>
          (Array.isArray(filters.mountingType) ? filters.mountingType : []).some(
            (opt: any) => String(opt.value) === value,
          ),
        ),
      );
      setSelectedStripType((prev) =>
        prev.filter((value) =>
          (Array.isArray(filters.stripType) ? filters.stripType : []).some(
            (opt: any) => String(opt.value).toLowerCase() === value.toLowerCase(),
          ),
        ),
      );
      setSelectedLedVoltage((prev) =>
        prev.filter((value) =>
          (Array.isArray(filters.ledVoltage) ? filters.ledVoltage : []).some(
            (opt: any) => String(opt.value) === value,
          ),
        ),
      );
      setSelectedLightColor((prev) =>
        prev.filter((value) =>
          (Array.isArray(filters.lightColor) ? filters.lightColor : []).some(
            (opt: any) => String(opt.value).toLowerCase() === value.toLowerCase(),
          ),
        ),
      );
    } catch (err) {
      console.error('Failed to fetch filters:', err);
      // Fallback to defaults already in state
    }
  };

  const isAbortLikeError = (error: unknown): boolean => {
    const maybeError = error as { name?: string; code?: string; message?: string };
    return (
      maybeError?.name === 'AbortError' ||
      maybeError?.code === 'ERR_CANCELED' ||
      maybeError?.message === 'canceled'
    );
  };

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

    trackAddToCart({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      quantity: 1,
      price: product.price,
      currency: product.currency || 'RON',
    });

    // Show success feedback
    setAddedToCart(product.id);
    setTimeout(() => setAddedToCart(null), 2000);
  };

  const fetchProducts = useCallback(async (pageToLoad = 1, append = false) => {
    const requestId = ++latestRequestIdRef.current;
    activeRequestAbortRef.current?.abort();
    const abortController = new AbortController();
    activeRequestAbortRef.current = abortController;

    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError('');
      }
      const params = {
        page: pageToLoad,
        limit: PAGE_SIZE,
        compact: true,
        search: searchQuery || undefined,
        category: selectedCategory !== 'Toate Produsele' ? selectedCategory : undefined,
        kelvin: selectedKelvin.length > 0 ? selectedKelvin : undefined,
        ip: selectedIp.length > 0 ? selectedIp : undefined,
        brand: selectedBrand.length > 0 ? selectedBrand : undefined,
        mountingType: selectedMountingType.length > 0 ? selectedMountingType : undefined,
        stripType: selectedStripType.length > 0 ? selectedStripType : undefined,
        ledVoltage: selectedLedVoltage.length > 0 ? selectedLedVoltage : undefined,
        lightColor: selectedLightColor.length > 0 ? selectedLightColor : undefined,
        min_price: priceMin ? parseFloat(priceMin) : undefined,
        max_price: priceMax ? parseFloat(priceMax) : undefined,
        sort: sortBy,
        stock: stockFilter !== 'all' ? stockFilter : undefined,
      };

      let response: any;
      let nextProducts: Product[] = [];
      let pagination: any = null;

      if (isAuthenticated) {
        response = await b2bApi.getProducts(params, { signal: abortController.signal });
        nextProducts = Array.isArray(response?.products) ? response.products : [];
        pagination = response?.pagination || null;
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
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to fetch products');
        }

        const payload = await response.json();
        const data = payload?.data ?? payload;
        nextProducts = Array.isArray(data?.products) ? data.products : [];
        pagination = data?.pagination || null;
      }

      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      setProducts((prev) => (append ? [...prev, ...nextProducts] : nextProducts));
      setCurrentPage(pageToLoad);
      setTotalPages(Math.max(1, Number(pagination?.total_pages || 1)));
      setTotalProducts(Number(pagination?.total || nextProducts.length));
    } catch (err) {
      if (isAbortLikeError(err)) {
        return;
      }

      if (requestId !== latestRequestIdRef.current) {
        return;
      }

      console.error('Failed to fetch products:', err);
      setError('Nu s-a putut încărca catalogul.');
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }

      if (activeRequestAbortRef.current === abortController) {
        activeRequestAbortRef.current = null;
      }
    }
  }, [
    PAGE_SIZE,
    isAuthenticated,
    priceMax,
    priceMin,
    searchQuery,
    selectedBrand,
    selectedCategory,
    selectedIp,
    selectedKelvin,
    selectedLedVoltage,
    selectedLightColor,
    selectedMountingType,
    selectedStripType,
    sortBy,
    stockFilter,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(1, false);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchProducts]);

  const filteredProducts = products;

  const handleLoadMore = useCallback(() => {
    if (loadingMore || currentPage >= totalPages) {
      return;
    }
    fetchProducts(currentPage + 1, true);
  }, [currentPage, fetchProducts, loadingMore, totalPages]);

  const prefetchProductDetails = useCallback((productId: number) => {
    if (!Number.isFinite(productId) || prefetchedProductIdsRef.current.has(productId)) {
      return;
    }

    prefetchedProductIdsRef.current.add(productId);
    fetch(`/api/v1/b2b/products/${productId}`, { credentials: 'include' }).catch(() => {
      prefetchedProductIdsRef.current.delete(productId);
    });
  }, []);

  useEffect(() => {
    return () => {
      activeRequestAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const firstImageUrl = products[0]?.image_url;
    if (!firstImageUrl || firstImageUrl === preloadedLcpImageRef.current) {
      return;
    }

    const preloadSelector = 'link[data-catalog-lcp="true"]';
    const existing = document.querySelector(preloadSelector);
    if (existing) {
      existing.remove();
    }

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = firstImageUrl;
    link.setAttribute('fetchpriority', 'high');
    link.setAttribute('data-catalog-lcp', 'true');
    document.head.appendChild(link);
    preloadedLcpImageRef.current = firstImageUrl;
  }, [products]);

  useEffect(() => {
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        handleLoadMore();
      },
      { root: null, rootMargin: AUTO_LOAD_ROOT_MARGIN, threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [AUTO_LOAD_ROOT_MARGIN, handleLoadMore]);

  const toggleKelvin = (val: string) => {
    setSelectedKelvin((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const toggleIp = (val: string) => {
    setSelectedIp((prev) => (prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]));
  };

  const toggleBrand = (val: string) => {
    setSelectedBrand((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const toggleMountingType = (val: string) => {
    setSelectedMountingType((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const toggleStripType = (val: string) => {
    setSelectedStripType((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const toggleLedVoltage = (val: string) => {
    setSelectedLedVoltage((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const toggleLightColor = (val: string) => {
    setSelectedLightColor((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val],
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Toate Produsele');
    setSelectedKelvin([]);
    setSelectedIp([]);
    setSelectedBrand([]);
    setSelectedMountingType([]);
    setSelectedStripType([]);
    setSelectedLedVoltage([]);
    setSelectedLightColor([]);
    setPriceMin('');
    setPriceMax('');
    setStockFilter('all');
  };

  // Check catalog visibility
  if (b2bSettings.catalogVisibility === 'hidden') {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#f8f9fa' }}
      >
        <div className="text-center max-w-md p-8">
          <Package size={64} className="mx-auto mb-6" style={{ color: '#daa520' }} />
          <h2 className="text-2xl font-bold text-text-primary mb-3">Catalog Temporar Indisponibil</h2>
          <p className="text-text-tertiary mb-6">
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
          className="min-h-screen flex items-center justify-center px-4"
          style={{ background: '#f8f9fa' }}
        >
          <div className="text-center max-w-md p-8">
            <Shield size={64} className="mx-auto mb-6" style={{ color: '#daa520' }} />
            <h2 className="text-2xl font-bold text-text-primary mb-3">Acces Restricționat</h2>
            <p className="text-text-tertiary mb-6">
              Catalogul este disponibil doar pentru clienții autentificați. Vă rugăm
              autentificați-vă pentru a vedea produsele.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: '#f8f9fa' }}
      >
        <div className="text-center">
          <Loader className="animate-spin mx-auto mb-4" size={40} style={{ color: '#daa520' }} />
          <p style={{ color: '#6b7280' }}>Se încarcă catalogul...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-hidden" style={{ background: '#f8f9fa', minHeight: '100vh' }}>
      {/* Header */}
      <div
        className="py-8 sm:py-10"
        style={{
          borderBottom: '1px solid rgba(218,165,32,0.1)',
          background: 'linear-gradient(180deg, rgba(218,165,32,0.06) 0%, #f8f9fa 100%)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">Catalog Produse</h1>
              <p className="text-sm mt-1" style={{ color: '#6b7280' }}>
                {totalProducts} produse disponibile
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
              {/* Search */}
              <div className="relative flex-grow md:w-80">
                <input
                  type="text"
                  placeholder="Caută produse, SKU-uri..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                  }}
                />
                <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: '#9ca3af' }} />
              </div>
              {/* Filter Toggle (Mobile) */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* ========== SIDEBAR FILTERS ========== */}
          <aside
            className={`w-full lg:w-72 flex-shrink-0 space-y-6 ${showFilters ? 'block' : 'hidden'} lg:block`}
          >
            {/* Categories */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
              }}
            >
              <h3 className="font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
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
                      color: selectedCategory === cat ? '#daa520' : '#6b7280',
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
            {availableFilters.stripType.length > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                }}
              >
                <h3 className="font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
                  <Zap size={14} style={{ color: '#daa520' }} />
                  Tip LED
                </h3>
                <div className="space-y-2">
                  {availableFilters.stripType.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedStripType.includes(opt.value)}
                        onChange={() => toggleStripType(opt.value)}
                        className="rounded"
                        style={{ accentColor: '#daa520' }}
                      />
                      <span className="text-sm" style={{ color: '#6b7280' }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {availableFilters.ledVoltage.length > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                }}
              >
                <h3 className="font-semibold text-text-primary text-sm mb-4">Voltaj</h3>
                <div className="space-y-2">
                  {availableFilters.ledVoltage.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLedVoltage.includes(opt.value)}
                        onChange={() => toggleLedVoltage(opt.value)}
                        className="rounded"
                        style={{ accentColor: '#daa520' }}
                      />
                      <span className="text-sm" style={{ color: '#6b7280' }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {availableFilters.lightColor.length > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                }}
              >
                <h3 className="font-semibold text-text-primary text-sm mb-4">Temperatura / Culoare</h3>
                <div className="space-y-2">
                  {availableFilters.lightColor.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLightColor.includes(opt.value)}
                        onChange={() => toggleLightColor(opt.value)}
                        className="rounded"
                        style={{ accentColor: '#daa520' }}
                      />
                      <span className="text-sm" style={{ color: '#6b7280' }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Color Temperature */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
              }}
            >
              <h3 className="font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
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
                    <span className="text-sm" style={{ color: '#6b7280' }}>
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
                        borderColor: '#d1d5db',
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
                background: '#ffffff',
                border: '1px solid #e5e7eb',
              }}
            >
              <h3 className="font-semibold text-text-primary text-sm mb-4 flex items-center gap-2">
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
                    <span className="text-sm" style={{ color: '#6b7280' }}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Manufacturer */}
            {availableFilters.brand.length > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                }}
              >
                <h3 className="font-semibold text-text-primary text-sm mb-4">Producator</h3>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {availableFilters.brand.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedBrand.includes(opt.value)}
                        onChange={() => toggleBrand(opt.value)}
                        className="rounded"
                        style={{ accentColor: '#daa520' }}
                      />
                      <span className="text-sm" style={{ color: '#6b7280' }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Mounting Type */}
            {availableFilters.mountingType.length > 0 && (
              <div
                className="rounded-2xl p-5"
                style={{
                  background: '#ffffff',
                  border: '1px solid #e5e7eb',
                }}
              >
                <h3 className="font-semibold text-text-primary text-sm mb-4">Montaj</h3>
                <div className="space-y-2">
                  {availableFilters.mountingType.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMountingType.includes(opt.value)}
                        onChange={() => toggleMountingType(opt.value)}
                        className="rounded"
                        style={{ accentColor: '#daa520' }}
                      />
                      <span className="text-sm" style={{ color: '#6b7280' }}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Price Range */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
              }}
            >
              <h3 className="font-semibold text-text-primary text-sm mb-4">Preț (RON)</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                  }}
                />
                <span style={{ color: '#6b7280' }}>—</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#111827',
                  }}
                />
              </div>
            </div>

            {/* Stock Filter */}
            <div
              className="rounded-2xl p-5"
              style={{
                background: '#ffffff',
                border: '1px solid #e5e7eb',
              }}
            >
              <h3 className="font-semibold text-text-primary text-sm mb-4">Disponibilitate</h3>
              <div className="space-y-2">
                {[
                  { label: 'Toate', value: 'all' as const },
                  { label: 'Stoc', value: 'stock' as const },
                  { label: 'Stoc Local', value: 'local' as const },
                  { label: 'Stoc Furnizor', value: 'supplier' as const },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStockFilter(opt.value)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm transition-all"
                    style={{
                      color: stockFilter === opt.value ? '#daa520' : '#6b7280',
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    color: viewMode === 'grid' ? '#daa520' : '#9ca3af',
                    background: viewMode === 'grid' ? 'rgba(218,165,32,0.08)' : 'transparent',
                  }}
                >
                  <Grid3X3 size={18} />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className="p-2 rounded-lg transition-all"
                  style={{
                    color: viewMode === 'list' ? '#daa520' : '#9ca3af',
                    background: viewMode === 'list' ? 'rgba(218,165,32,0.08)' : 'transparent',
                  }}
                >
                  <List size={18} />
                </button>
              </div>
              <div className="relative w-full sm:w-auto">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none w-full sm:w-auto px-4 py-2 pr-8 rounded-xl text-sm focus:outline-none cursor-pointer"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #d1d5db',
                    color: '#374151',
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
                  style={{ color: '#9ca3af' }}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-center py-16">
                <p style={{ color: '#ef4444' }}>{error}</p>
                <Button
                  onClick={() => fetchProducts(1, false)}
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
                <Package size={48} className="mx-auto mb-4" style={{ color: '#9ca3af' }} />
                <p className="text-lg font-medium text-text-primary mb-2">Niciun produs găsit</p>
                <p className="text-sm mb-4" style={{ color: '#6b7280' }}>
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
                {filteredProducts.map((product, index) => {
                  const specs = parseSpecs(product);
                  const shouldPrioritizeImage = currentPage === 1 && index < 2;
                  return (
                    <div
                      key={product.id}
                      className="rounded-2xl overflow-hidden group transition-all duration-300 hover:-translate-y-1"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        contentVisibility: 'auto',
                        containIntrinsicSize: '430px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(218,165,32,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      {/* Image */}
                      <div
                        className="relative h-52 overflow-hidden"
                        style={{ background: '#f3f4f6' }}
                      >
                        {product.image_url ? (
                          <ResponsiveImage
                            src={product.image_url}
                            alt={product.name}
                            loading={shouldPrioritizeImage ? 'eager' : 'lazy'}
                            fetchPriority={shouldPrioritizeImage ? 'high' : 'low'}
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            width={640}
                            height={520}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Zap size={40} style={{ color: '#d1d5db' }} />
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
                        {(b2bSettings.showStock || isAuthenticated) && product.stock_local > 0 && (
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
                        <Link
                          to={`/b2b-store/product/${product.id}`}
                          onMouseEnter={() => prefetchProductDetails(product.id)}
                          onFocus={() => prefetchProductDetails(product.id)}
                          onTouchStart={() => prefetchProductDetails(product.id)}
                        >
                          <h3
                            className="font-bold text-text-primary mb-1 line-clamp-2 hover:underline cursor-pointer leading-snug"
                            title={product.name}
                          >
                            {product.name}
                          </h3>
                        </Link>
                        <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                          SKU: {product.sku}
                        </p>
                        {getManufacturer(product) && (
                          <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                            Producator: {getManufacturer(product)}
                          </p>
                        )}

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
                        {(b2bSettings.showStock || isAuthenticated) && (
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
                            {getSupplierStockDisplay(product) && (
                              <span
                                className="flex items-center gap-1.5"
                                style={{ color: getSupplierStockDisplay(product)!.color }}
                              >
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ background: getSupplierStockDisplay(product)!.dot }}
                                />
                                {getSupplierStockDisplay(product)!.label}
                              </span>
                            )}
                            <span
                              className="flex items-center gap-1.5"
                              style={{ color: '#6b7280' }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ background: '#6b7280' }}
                              />
                              Total: {getTotalStock(product)} buc
                            </span>
                          </div>
                        )}

                        {/* Price + Cart */}
                        <div
                          className="flex items-center justify-between pt-4"
                          style={{ borderTop: '1px solid #e5e7eb' }}
                        >
                          {b2bSettings.showPrices || isAuthenticated ? (
                            <div>
                              <div className="text-xl font-bold" style={{ color: '#daa520' }}>
                                {product.price.toFixed(2)}{' '}
                                <span className="text-xs font-normal" style={{ color: '#6b7280' }}>
                                  {product.currency}
                                </span>
                              </div>
                              <div className="text-[10px]" style={{ color: '#6b7280' }}>
                                fără TVA
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm" style={{ color: '#6b7280' }}>
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
                {filteredProducts.map((product, index) => {
                  const specs = parseSpecs(product);
                  const shouldPrioritizeImage = currentPage === 1 && index < 2;
                  return (
                    <div
                      key={product.id}
                      className="rounded-2xl overflow-hidden flex flex-col sm:flex-row transition-all duration-300"
                      style={{
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        contentVisibility: 'auto',
                        containIntrinsicSize: '220px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(218,165,32,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                    >
                      {/* Image */}
                      <div
                        className="w-full h-52 sm:w-36 sm:h-36 md:w-48 md:h-auto flex-shrink-0"
                        style={{ background: '#f3f4f6' }}
                      >
                        {product.image_url ? (
                          <ResponsiveImage
                            src={product.image_url}
                            alt={product.name}
                            loading={shouldPrioritizeImage ? 'eager' : 'lazy'}
                            fetchPriority={shouldPrioritizeImage ? 'high' : 'low'}
                            sizes="(max-width: 640px) 100vw, 40vw"
                            width={480}
                            height={360}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Zap size={32} style={{ color: '#d1d5db' }} />
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
                          <Link
                            to={`/b2b-store/product/${product.id}`}
                            onMouseEnter={() => prefetchProductDetails(product.id)}
                            onFocus={() => prefetchProductDetails(product.id)}
                            onTouchStart={() => prefetchProductDetails(product.id)}
                          >
                            <h3 className="font-bold text-text-primary mb-2 hover:underline">
                              {product.name}
                            </h3>
                          </Link>
                          {getManufacturer(product) && (
                            <p className="text-xs mb-2" style={{ color: '#6b7280' }}>
                              Producator: {getManufacturer(product)}
                            </p>
                          )}
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
                          {(b2bSettings.showStock || isAuthenticated) && (
                            <div className="flex gap-4 text-xs">
                              {product.stock_local > 0 && (
                                <span style={{ color: '#10b981' }}>
                                  ● Stoc Local: {product.stock_local}
                                </span>
                              )}
                              {getSupplierStockDisplay(product) && (
                                <span style={{ color: getSupplierStockDisplay(product)!.color }}>
                                  ● {getSupplierStockDisplay(product)!.label}
                                </span>
                              )}
                              <span style={{ color: '#6b7280' }}>
                                ● Total: {getTotalStock(product)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between sm:justify-start gap-4 flex-shrink-0">
                          {b2bSettings.showPrices || isAuthenticated ? (
                            <div className="text-left sm:text-right">
                              <div className="text-xl font-bold" style={{ color: '#daa520' }}>
                                {product.price.toFixed(2)} {product.currency}
                              </div>
                              <div className="text-[10px]" style={{ color: '#6b7280' }}>
                                fără TVA
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-right" style={{ color: '#6b7280' }}>
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
            {filteredProducts.length > 0 && currentPage < totalPages && (
              <div className="mt-10 flex justify-center">
                <Button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="rounded-full px-8"
                  style={{ borderColor: 'rgba(218,165,32,0.2)', color: '#daa520' }}
                >
                  {loadingMore ? 'Se incarca...' : 'Incarca Mai Multe'}
                </Button>
              </div>
            )}

            {!loading && filteredProducts.length > 0 && currentPage < totalPages && (
              <div ref={loadMoreSentinelRef} className="h-1 w-full" aria-hidden="true" />
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
            className="w-full max-w-3xl rounded-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            style={{
              background: '#ffffff',
              border: '1px solid #e5e7eb',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col md:flex-row">
              {/* Image */}
              <div className="w-full md:w-1/2 h-64 md:h-auto" style={{ background: '#f3f4f6' }}>
                {quickViewProduct.image_url ? (
                  <ResponsiveImage
                    src={quickViewProduct.image_url}
                    alt={quickViewProduct.name}
                    loading="eager"
                    fetchPriority="high"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    width={960}
                    height={640}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Zap size={60} style={{ color: '#d1d5db' }} />
                  </div>
                )}
              </div>
              {/* Details */}
              <div className="flex-1 p-4 sm:p-7">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                      style={{ color: '#daa520' }}
                    >
                      {quickViewProduct.category || 'LED'}
                    </p>
                    <h2 className="text-2xl font-bold text-text-primary">{quickViewProduct.name}</h2>
                    <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                      SKU: {quickViewProduct.sku}
                    </p>
                    {getManufacturer(quickViewProduct) && (
                      <p className="text-xs mt-1" style={{ color: '#6b7280' }}>
                        Producator: {getManufacturer(quickViewProduct)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setQuickViewProduct(null)}
                    className="p-1.5 rounded-lg"
                    style={{ color: '#6b7280' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                <p className="text-sm mb-6 leading-relaxed" style={{ color: '#6b7280' }}>
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
                {(b2bSettings.showStock || isAuthenticated) && (
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
                    {getSupplierStockDisplay(quickViewProduct) && (
                      <span
                        className="flex items-center gap-2"
                        style={{ color: getSupplierStockDisplay(quickViewProduct)!.color }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: getSupplierStockDisplay(quickViewProduct)!.dot }}
                        />
                        {getSupplierStockDisplay(quickViewProduct)!.label}
                      </span>
                    )}
                    <span className="flex items-center gap-2" style={{ color: '#6b7280' }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: '#6b7280' }} />
                      Total: {getTotalStock(quickViewProduct)} buc
                    </span>
                  </div>
                )}

                {/* Price */}
                {b2bSettings.showPrices || isAuthenticated ? (
                  <div className="mb-6 pb-6" style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <div className="text-3xl font-bold" style={{ color: '#daa520' }}>
                      {quickViewProduct.price.toFixed(2)}{' '}
                      <span className="text-sm font-normal" style={{ color: '#6b7280' }}>
                        {quickViewProduct.currency} fără TVA
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mb-6 pb-6" style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <div className="text-lg" style={{ color: '#6b7280' }}>
                      Autentifică-te pentru a vedea prețul
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col sm:flex-row gap-3">
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
