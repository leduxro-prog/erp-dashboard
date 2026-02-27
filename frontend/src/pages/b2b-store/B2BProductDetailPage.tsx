import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShoppingCart,
  Heart,
  Share2,
  Download,
  Package,
  Truck,
  Shield,
  Zap,
  Loader,
  FileText,
  ChevronRight,
  Minus,
  Plus,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ResponsiveImage } from '../../components/ui/ResponsiveImage';
import { trackViewItem } from '../../services/retargeting';

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
  supplier_name?: string | null;
  rating?: number;
  category?: string;
  specifications?: Record<string, any> | null;
}

const getSupplierStockDetail = (
  product: Product,
): { available: boolean; quantityText: string; color: string } | null => {
  const supplierName = String(product.supplier_name || '').toLowerCase();
  const isMplSupplier = supplierName.includes('mpl power');

  if (isMplSupplier) {
    const available = product.stock_supplier > 0;
    return {
      available,
      quantityText: available ? 'Disponibil' : 'Indisponibil',
      color: available ? '#4f8eff' : '#ef4444',
    };
  }

  if (product.stock_supplier <= 0) {
    return null;
  }

  return {
    available: true,
    quantityText: `${product.stock_supplier} buc`,
    color: '#4f8eff',
  };
};

const parseSpecs = (product: Product) => {
  const apiSpecs = (product.specifications || {}) as Record<string, any>;
  const text = `${product.name} ${product.description}`.toLowerCase();
  const wattMatch = text.match(/(\d+)\s*w(?:att)?/i);
  const kelvinMatch = text.match(/(\d{4})\s*k/i);
  const ipMatch = text.match(/ip\s*(\d{2})/i);
  const lumenMatch = text.match(/(\d+)\s*(?:lm|lumen)/i);

  const watt = apiSpecs.wattage || (wattMatch ? wattMatch[1] : '—');
  const kelvin = apiSpecs.color_temperature || (kelvinMatch ? kelvinMatch[1] : '—');
  const ip = apiSpecs.ip_rating || (ipMatch ? `IP${ipMatch[1]}` : '—');
  const lumen = apiSpecs.lumens || (lumenMatch ? lumenMatch[1] : '—');

  return {
    watt,
    kelvin,
    ip,
    lumen,
    cri: apiSpecs.cri || '—',
    beamAngle: apiSpecs.beam_angle || '—',
    voltageInput: apiSpecs.voltage_input || '—',
    mountingType: apiSpecs.mounting_type || '—',
    brand: apiSpecs.brand || '—',
  };
};

const parseMaytoniResources = (product: Product) => {
  const specs = (product.specifications || {}) as Record<string, any>;
  const customSpecs = (specs.custom_specs || {}) as Record<string, any>;
  const resources = (customSpecs.resurse_maytoni || {}) as Record<string, any>;

  const entries: Array<{ label: string; url: string }> = [];
  const add = (label: string, value: any) => {
    if (typeof value === 'string' && value.trim().startsWith('http')) {
      entries.push({ label, url: value.trim() });
    }
  };

  add('Instructiune PDF', resources.instructiune_pdf);
  add('Instructiune', resources.instructiune_link);
  add('Instructiune Engleza PDF', resources.instructiune_engleza_pdf);
  add('Instructiune Germana PDF', resources.instructiune_germana_pdf);
  add('Instructiune Spaniola PDF', resources.instructiune_spaniola_pdf);
  add('Instructiune Franceza PDF', resources.instructiune_franceza_pdf);
  add('Instructiune Italiana PDF', resources.instructiune_italiana_pdf);
  add('Instructiune Poloneza PDF', resources.instructiune_poloneza_pdf);
  add('Model 3D / 360', resources.model_3d_360);
  add('Eticheta energetica UE (PDF)', resources.eticheta_energetica_pdf);
  add('Eticheta energetica (imagine)', resources.eticheta_energetica_imagine);
  add('Schema web', resources.schema_web);
  add('Plan tehnic (Blueprint)', resources.plan_tehnic_blueprint);
  add('Randare principala', resources.randare_principala);
  add('Randare fundal alb', resources.randare_fundal_alb);
  add('Randare caracteristica tehnica', resources.randare_caracteristica_tehnica);
  add('Cum lumineaza', resources.cum_lumineaza);

  return entries;
};

export const B2BProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [selectedTab, setSelectedTab] = useState<'specs' | 'pricing' | 'delivery'>('specs');

  useEffect(() => {
    const abortController = new AbortController();
    fetchProduct(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!product) {
      return;
    }

    trackViewItem({
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      price: product.price,
      currency: product.currency || 'RON',
      quantity: 1,
    });
  }, [product]);

  const fetchProduct = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/b2b/products/${id}`, {
        credentials: 'include',
        signal,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch product');
      }

      const payload = await response.json();
      const data = payload?.data ?? payload;

      if (data?.success && data?.data) {
        setProduct(data.data);
      } else if (data?.id) {
        setProduct(data);
      }
    } catch (err) {
      const maybeError = err as { name?: string; code?: string; message?: string };
      if (
        maybeError?.name === 'AbortError' ||
        maybeError?.code === 'ERR_CANCELED' ||
        maybeError?.message === 'canceled'
      ) {
        return;
      }

      console.error('Failed to fetch product:', err);
      // Fallback: try from products list
      try {
        const fallbackQuery = new URLSearchParams({
          page: '1',
          limit: '24',
          search: String(id || ''),
        });
        const listResponse = await fetch(`/api/v1/b2b/products?${fallbackQuery.toString()}`, {
          credentials: 'include',
          signal,
        });

        if (!listResponse.ok) {
          throw new Error('Failed to fetch products list');
        }

        const listPayload = await listResponse.json();
        const listData = listPayload?.data ?? listPayload;

        if (listData?.success && listData?.data?.products) {
          const found = listData.data.products.find((p: Product) => p.id === Number(id));
          if (found) setProduct(found);
        } else if (Array.isArray(listData?.products)) {
          const found = listData.products.find((p: Product) => p.id === Number(id));
          if (found) setProduct(found);
        }
      } catch (fallbackErr) {
        const fallbackMaybeError = fallbackErr as { name?: string; code?: string; message?: string };
        if (
          fallbackMaybeError?.name === 'AbortError' ||
          fallbackMaybeError?.code === 'ERR_CANCELED' ||
          fallbackMaybeError?.message === 'canceled'
        ) {
          return;
        }

        // ignore
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  const adjustQuantity = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#0a0a0f' }}
      >
        <Loader className="animate-spin" size={40} style={{ color: '#daa520' }} />
      </div>
    );
  }

  if (!product) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-4"
        style={{ background: '#0a0a0f' }}
      >
        <Package size={48} style={{ color: '#333' }} />
        <p className="text-white text-lg">Produsul nu a fost găsit</p>
        <Link to="/b2b-store/catalog">
          <Button style={{ background: '#daa520', color: '#000' }}>Înapoi la Catalog</Button>
        </Link>
      </div>
    );
  }

  const specs = parseSpecs(product);
  const maytoniResources = parseMaytoniResources(product);
  const totalStock =
    Number(product.stock_total ?? 0) || product.stock_local + product.stock_supplier;

  const tieredPricing = [
    { range: '1 — 9 buc', price: product.price, discount: '—' },
    { range: '10 — 49 buc', price: +(product.price * 0.95).toFixed(2), discount: '-5%' },
    { range: '50 — 99 buc', price: +(product.price * 0.9).toFixed(2), discount: '-10%' },
    { range: '100+ buc', price: +(product.price * 0.85).toFixed(2), discount: '-15%' },
  ];

  const getCurrentTierPrice = () => {
    if (quantity >= 100) return tieredPricing[3].price;
    if (quantity >= 50) return tieredPricing[2].price;
    if (quantity >= 10) return tieredPricing[1].price;
    return tieredPricing[0].price;
  };

  const specRows = [
    { label: 'Putere', value: `${specs.watt}W`, icon: '⚡' },
    { label: 'Temperatură Culoare', value: `${specs.kelvin}K`, icon: '🌡' },
    { label: 'Flux Luminos', value: `${specs.lumen} lm`, icon: '💡' },
    { label: 'Grad Protecție', value: specs.ip, icon: '💧' },
    { label: 'CRI', value: String(specs.cri), icon: '🎨' },
    { label: 'Unghi fascicul', value: `${specs.beamAngle}°`, icon: '📐' },
    { label: 'Tensiune', value: String(specs.voltageInput), icon: '🔌' },
    { label: 'Montaj', value: String(specs.mountingType), icon: '🔧' },
    { label: 'Brand', value: String(specs.brand), icon: '🏷' },
    { label: 'Certificări', value: 'CE, RoHS', icon: '✅' },
  ];

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100vh' }}>
      {/* Breadcrumb */}
      <div className="py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs" style={{ color: '#555' }}>
            <Link to="/b2b-store" className="hover:text-white transition-colors">
              Acasă
            </Link>
            <ChevronRight size={12} />
            <Link to="/b2b-store/catalog" className="hover:text-white transition-colors">
              Catalog
            </Link>
            <ChevronRight size={12} />
            <span style={{ color: '#daa520' }}>{product.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Back Link */}
        <Link
          to="/b2b-store/catalog"
          className="inline-flex items-center gap-2 text-sm font-medium mb-8 transition-colors"
          style={{ color: '#888' }}
        >
          <ArrowLeft size={16} />
          Înapoi la Catalog
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* ========== LEFT: IMAGE ========== */}
          <div>
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                background: '#111118',
                border: '1px solid rgba(255,255,255,0.06)',
                height: '500px',
              }}
            >
              {product.image_url ? (
                <ResponsiveImage
                  src={product.image_url}
                  alt={product.name}
                  loading="eager"
                  fetchPriority="high"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  width={1200}
                  height={1200}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Zap size={80} style={{ color: '#1a1a22' }} />
                </div>
              )}
              {product.stock_local > 0 && (
                <div
                  className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide"
                  style={{ background: 'rgba(16, 185, 129, 0.9)', color: '#fff' }}
                >
                  ✓ Stoc Local
                </div>
              )}
            </div>

            {/* Action icons */}
            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#888',
                }}
              >
                <Heart size={16} /> Salvează
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#888',
                }}
              >
                <Share2 size={16} /> Distribuie
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm transition-all"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#888',
                }}
              >
                <Download size={16} /> Fișă Tehnică
              </button>
            </div>
          </div>

          {/* ========== RIGHT: DETAILS ========== */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: '#daa520' }}
            >
              {product.category || 'LED'} · SKU: {product.sku}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              {product.name}
            </h1>

            {/* Spec Badges */}
            <div className="flex flex-wrap gap-2 mb-6">
              {specs.watt !== '—' && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(218,165,32,0.1)',
                    color: '#daa520',
                    border: '1px solid rgba(218,165,32,0.2)',
                  }}
                >
                  ⚡ {specs.watt}W
                </span>
              )}
              {specs.kelvin !== '—' && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(79,142,255,0.1)',
                    color: '#4f8eff',
                    border: '1px solid rgba(79,142,255,0.2)',
                  }}
                >
                  🌡 {specs.kelvin}K
                </span>
              )}
              {specs.ip !== '—' && (
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
              {specs.lumen !== '—' && (
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: 'rgba(251,191,36,0.1)',
                    color: '#fbbf24',
                    border: '1px solid rgba(251,191,36,0.2)',
                  }}
                >
                  💡 {specs.lumen}lm
                </span>
              )}
            </div>

            <p className="text-sm leading-relaxed mb-8" style={{ color: '#777' }}>
              {product.description ||
                'Corp de iluminat LED de înaltă calitate, proiectat pentru instalații profesionale. Eficiență energetică ridicată și durată de viață extinsă.'}
            </p>

            {/* Stock Status */}
            <div
              className="rounded-xl p-5 mb-6"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <h4
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: '#888' }}
              >
                Disponibilitate
              </h4>
              <div className="space-y-2.5">
                {product.stock_local > 0 ? (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm" style={{ color: '#10b981' }}>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: '#10b981' }}
                      />
                      Stoc Local
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {product.stock_local} buc —{' '}
                      <span style={{ color: '#10b981' }}>Livrare 24h</span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm" style={{ color: '#ef4444' }}>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: '#ef4444' }}
                      />
                      Stoc Local
                    </span>
                    <span className="text-sm" style={{ color: '#ef4444' }}>
                      Epuizat
                    </span>
                  </div>
                )}
                {getSupplierStockDetail(product) && (
                  <div className="flex items-center justify-between">
                    <span
                      className="flex items-center gap-2 text-sm"
                      style={{ color: getSupplierStockDetail(product)!.color }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ background: getSupplierStockDetail(product)!.color }}
                      />
                      Stoc Furnizor
                    </span>
                    <span className="text-sm font-semibold text-white">
                      {getSupplierStockDetail(product)!.quantityText} —{' '}
                      <span style={{ color: getSupplierStockDetail(product)!.color }}>
                        {product.supplier_lead_time} zile
                      </span>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm" style={{ color: '#6b7280' }}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#6b7280' }} />
                    Stoc Total
                  </span>
                  <span className="text-sm font-semibold text-white">{totalStock} buc</span>
                </div>
              </div>
            </div>

            {/* Price */}
            <div
              className="rounded-xl p-6 mb-6"
              style={{
                background: 'rgba(218,165,32,0.04)',
                border: '1px solid rgba(218,165,32,0.12)',
              }}
            >
              <div className="flex items-end gap-3 mb-1">
                <span className="text-4xl font-bold" style={{ color: '#daa520' }}>
                  {getCurrentTierPrice().toFixed(2)}
                </span>
                <span className="text-lg mb-1" style={{ color: '#666' }}>
                  {product.currency}
                </span>
                <span
                  className="text-xs mb-1.5 px-2 py-0.5 rounded"
                  style={{ background: 'rgba(218,165,32,0.1)', color: '#daa520' }}
                >
                  fără TVA
                </span>
              </div>
              {quantity >= 10 && (
                <p className="text-xs" style={{ color: '#10b981' }}>
                  ✓ Ai discount de volum aplicat automat!
                </p>
              )}
            </div>

            {/* Quantity + Add to Cart */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className="flex items-center rounded-xl overflow-hidden"
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <button
                  onClick={() => adjustQuantity(-1)}
                  className="w-12 h-12 flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', color: '#888' }}
                >
                  <Minus size={16} />
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 h-12 text-center text-sm font-semibold focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.02)', color: '#fff', border: 'none' }}
                />
                <button
                  onClick={() => adjustQuantity(1)}
                  className="w-12 h-12 flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(255,255,255,0.03)', color: '#888' }}
                >
                  <Plus size={16} />
                </button>
              </div>
              <Button
                className="flex-1 h-12 rounded-xl text-black font-semibold text-base"
                style={{
                  background: 'linear-gradient(135deg, #daa520, #ffd700)',
                  boxShadow: '0 4px 20px rgba(218,165,32,0.25)',
                }}
              >
                <ShoppingCart size={18} className="mr-2" />
                Adaugă în Coș — {(getCurrentTierPrice() * quantity).toFixed(2)} {product.currency}
              </Button>
            </div>

            {/* Request Quote */}
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl"
              style={{ borderColor: 'rgba(218,165,32,0.2)', color: '#daa520' }}
            >
              <FileText size={16} className="mr-2" />
              Solicită Ofertă Personalizată
            </Button>

            {/* Trust Badges */}
            <div className="grid grid-cols-3 gap-3 mt-6">
              {[
                { icon: <Truck size={16} />, text: 'Livrare Rapidă' },
                { icon: <Shield size={16} />, text: 'Garanție 3 Ani' },
                { icon: <Package size={16} />, text: 'Retur 30 Zile' },
              ].map((badge) => (
                <div
                  key={badge.text}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl text-center"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <span style={{ color: '#daa520' }}>{badge.icon}</span>
                  <span className="text-[10px] font-medium" style={{ color: '#666' }}>
                    {badge.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ========== TABS: SPECS / PRICING / DELIVERY ========== */}
        <div className="mt-16">
          <div
            className="flex gap-6 mb-8"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            {[
              { key: 'specs' as const, label: 'Specificații Tehnice' },
              { key: 'pricing' as const, label: 'Prețuri pe Cantitate' },
              { key: 'delivery' as const, label: 'Livrare & Garanție' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSelectedTab(tab.key)}
                className="pb-4 text-sm font-medium transition-colors relative"
                style={{
                  color: selectedTab === tab.key ? '#daa520' : '#666',
                }}
              >
                {tab.label}
                {selectedTab === tab.key && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5"
                    style={{ background: '#daa520' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Specs Tab */}
          {selectedTab === 'specs' && (
            <div className="space-y-4">
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                {specRows.map((row, idx) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between px-6 py-4"
                    style={{
                      borderBottom:
                        idx < specRows.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}
                  >
                    <span className="flex items-center gap-3 text-sm" style={{ color: '#888' }}>
                      <span>{row.icon}</span>
                      {row.label}
                    </span>
                    <span className="text-sm font-semibold text-white">{row.value}</span>
                  </div>
                ))}
              </div>

              {maytoniResources.length > 0 && (
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                >
                  <div
                    className="px-6 py-4 text-sm font-semibold"
                    style={{ color: '#daa520', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                  >
                    Documente si resurse
                  </div>
                  {maytoniResources.map((item, idx) => (
                    <a
                      key={`${item.label}-${idx}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between px-6 py-3 text-sm hover:bg-white/5 transition-colors"
                      style={{
                        borderBottom:
                          idx < maytoniResources.length - 1
                            ? '1px solid rgba(255,255,255,0.04)'
                            : 'none',
                        color: '#ddd',
                      }}
                    >
                      <span>{item.label}</span>
                      <Download size={14} style={{ color: '#9ca3af' }} />
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pricing Tab */}
          {selectedTab === 'pricing' && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div
                className="grid grid-cols-3 px-6 py-3 text-xs font-semibold uppercase tracking-wider"
                style={{ color: '#666', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span>Cantitate</span>
                <span className="text-center">Preț / Buc</span>
                <span className="text-right">Discount</span>
              </div>
              {tieredPricing.map((tier, idx) => (
                <div
                  key={tier.range}
                  className="grid grid-cols-3 items-center px-6 py-4"
                  style={{
                    borderBottom:
                      idx < tieredPricing.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                  }}
                >
                  <span className="text-sm text-white font-medium">{tier.range}</span>
                  <span className="text-sm font-bold text-center" style={{ color: '#daa520' }}>
                    {tier.price.toFixed(2)} {product.currency}
                  </span>
                  <span
                    className="text-sm text-right font-semibold"
                    style={{ color: tier.discount !== '—' ? '#10b981' : '#555' }}
                  >
                    {tier.discount}
                  </span>
                </div>
              ))}
              <div
                className="px-6 py-4 text-xs"
                style={{
                  color: '#666',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(218,165,32,0.03)',
                }}
              >
                💡 Pentru cantități mai mari de 500 buc, solicită ofertă personalizată prin butonul
                de mai sus.
              </div>
            </div>
          )}

          {/* Delivery Tab */}
          {selectedTab === 'delivery' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Truck size={18} style={{ color: '#daa520' }} />
                  Livrare
                </h4>
                <div className="space-y-3 text-sm" style={{ color: '#888' }}>
                  <p>
                    • Produse din stoc local:{' '}
                    <span className="text-white font-medium">livrare în 24-48h</span>
                  </p>
                  <p>
                    • Produse de la furnizor:{' '}
                    <span className="text-white font-medium">
                      {product.supplier_lead_time} zile lucrătoare
                    </span>
                  </p>
                  <p>
                    • Transport gratuit pentru comenzi peste{' '}
                    <span className="text-white font-medium">2,000 RON</span>
                  </p>
                  <p>• Livrare cu tracking în timp real</p>
                  <p>• Opțiune livrare express disponibilă</p>
                </div>
              </div>
              <div
                className="rounded-2xl p-6"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Shield size={18} style={{ color: '#daa520' }} />
                  Garanție & Retur
                </h4>
                <div className="space-y-3 text-sm" style={{ color: '#888' }}>
                  <p>
                    • Garanție producător: <span className="text-white font-medium">3 ani</span>
                  </p>
                  <p>
                    • Retur gratuit în <span className="text-white font-medium">30 de zile</span>
                  </p>
                  <p>• Suport tehnic dedicat prin WhatsApp și email</p>
                  <p>
                    • Certificări: <span className="text-white font-medium">CE, RoHS, TUV</span>
                  </p>
                  <p>• Înlocuire rapidă pentru produse defecte</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
