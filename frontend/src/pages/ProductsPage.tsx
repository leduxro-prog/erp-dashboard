import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Package,
  RefreshCw,
  Filter,
  X,
  Upload,
  Image,
  Download,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { apiClient } from '@/services/api';
import { inventoryService } from '@/services/inventory.service';
import { useGlobalLanguage } from '@/hooks/useLanguage';

interface Product {
  id: number;
  productId: number;
  name: string;
  sku: string;
  categoryId: number | null;
  categoryName: string;
  price: number;
  imageUrl: string | null;
  warehouseId: number;
  warehouseName: string;
  current: number;
  reserved: number;
  available: number;
  localStock: number;
  supplierStock: number;
  totalStock: number;
  supplierLeadTime?: number;
  reorderPoint: number;
  status: 'Normal' | 'Atentionare' | 'Critic';
  updatedAt: string;
  specifications?: Record<string, unknown> | null;
  wattage?: number | string | null;
  lumens?: number | string | null;
  color_temperature?: number | string | null;
  colorTemperature?: number | string | null;
  ip_rating?: string | null;
  ipRating?: string | null;
  cri?: number | string | null;
  beam_angle?: number | string | null;
  beamAngle?: number | string | null;
  voltage_input?: string | null;
  voltageInput?: string | null;
  mounting_type?: string | null;
  mountingType?: string | null;
}

interface Category {
  id: number;
  name: string;
  slug?: string;
}

interface FacetOption {
  value: string;
  label: string;
  count: number;
}

interface CategoryFacet {
  key: string;
  label: string;
  options: FacetOption[];
}

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'price-asc'
  | 'price-desc'
  | 'stock-asc'
  | 'stock-desc';

const SORT_LABELS: Record<SortOption, { ro: string; en: string }> = {
  'name-asc': { ro: 'Nume A-Z', en: 'Name A-Z' },
  'name-desc': { ro: 'Nume Z-A', en: 'Name Z-A' },
  'price-asc': { ro: 'Preț crescător', en: 'Price ascending' },
  'price-desc': { ro: 'Preț descrescător', en: 'Price descending' },
  'stock-asc': { ro: 'Stoc crescător', en: 'Stock ascending' },
  'stock-desc': { ro: 'Stoc descrescător', en: 'Stock descending' },
};

const STATUS_OPTIONS = ['Toate', 'Normal', 'Atentionare', 'Critic'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Image Upload Modal Component (Upload manual + Cautare automata)
// ─────────────────────────────────────────────────────────────────────────────
interface ImageUploadModalProps {
  product: Product | null;
  onClose: () => void;
  onUploaded: (productId: number, imageUrl: string) => void;
}

type ModalTab = 'upload' | 'search';

interface SearchCandidate {
  url: string;
  source: string;
  confidence: string;
}

function ImageUploadModal({ product, onClose, onUploaded }: ImageUploadModalProps) {
  const { language } = useGlobalLanguage();
  const tr = (ro: string, en: string) => (language === 'ro' ? ro : en);
  const [tab, setTab] = useState<ModalTab>('search');
  // Upload tab state
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Search tab state
  const [searching, setSearching] = useState(false);
  const [candidates, setCandidates] = useState<SearchCandidate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selecting, setSelecting] = useState<string | null>(null);
  const [searchDone, setSearchDone] = useState(false);

  if (!product) return null;

  // ── Upload tab handlers ──
  const handleFile = (file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowed.includes(file.type)) {
      setError(tr('Format invalid. Doar JPG, PNG, WebP, GIF, SVG.', 'Invalid format. Only JPG, PNG, WebP, GIF, SVG.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(tr('Fișierul depășește 5 MB.', 'File exceeds 5 MB.'));
      return;
    }
    setError(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !product) return;
    setUploading(true);
    setError(null);
    try {
      const result = await inventoryService.uploadProductImage(product.productId, selectedFile, {
        isPrimary: true,
      });
      onUploaded(product.productId, result.image_url);
      onClose();
    } catch (err: any) {
      setError(err.message || tr('Eroare la upload', 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  // ── Search tab handlers ──
  const handleSearch = async (customQuery?: string) => {
    if (!product) return;
    setSearching(true);
    setError(null);
    setCandidates([]);
    setSearchDone(false);
    try {
      const result = await inventoryService.searchProductImage(
        product.productId,
        customQuery || undefined,
      );
      setCandidates(result.candidates || []);
      setSearchDone(true);
      if (result.candidates.length === 0) {
        setError(
          tr(
            'Nu s-au găsit imagini. Încearcă un termen de căutare diferit.',
            'No images found. Try a different search term.',
          ),
        );
      }
    } catch (err: any) {
      setError(err.message || tr('Eroare la căutare', 'Search failed'));
      setSearchDone(true);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectCandidate = async (candidateUrl: string) => {
    if (!product) return;
    setSelecting(candidateUrl);
    setError(null);
    try {
      const result = await inventoryService.selectSearchedImage(product.productId, candidateUrl);
      onUploaded(product.productId, result.image_url);
      onClose();
    } catch (err: any) {
      setError(err.message || tr('Eroare la salvarea imaginii', 'Failed to save image'));
    } finally {
      setSelecting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-2xl mx-3 sm:mx-4 p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Image size={20} />
              {tr('Imagine produs', 'Product image')}
            </h3>
            <p className="text-sm text-gray-400 mt-0.5 truncate">{product.name}</p>
            <p className="text-xs text-gray-500">SKU: {product.sku}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Current image */}
        {product.imageUrl && (
          <div className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-14 h-14 object-cover rounded border border-gray-600"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <p className="text-sm text-gray-300">{tr('Imagine curentă', 'Current image')}</p>
              <p className="text-xs text-gray-500 truncate">{product.imageUrl}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-700 overflow-x-auto">
          <button
            onClick={() => setTab('search')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === 'search'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search size={14} />
              {tr('Căutare automată', 'Automatic search')}
            </div>
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === 'upload'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Upload size={14} />
              {tr('Upload manual', 'Manual upload')}
            </div>
          </button>
        </div>

        {/* ── Search Tab ── */}
        {tab === 'search' && (
          <div className="space-y-4">
            {/* Search controls */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={tr(
                  'Caută după SKU, denumire, cod produs...',
                  'Search by SKU, name, product code...',
                )}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch(searchQuery || undefined);
                }}
                className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={() => handleSearch(searchQuery || undefined)}
                disabled={searching}
                className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 flex-shrink-0"
              >
                {searching ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    {tr('Se caută...', 'Searching...')}
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    {tr('Caută', 'Search')}
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500">
              {tr(
                'Lasă câmpul gol pentru căutare automată pe baza SKU-ului și denumirii produsului, sau introdu un termen personalizat.',
                'Leave the field empty for automatic search based on SKU and product name, or enter a custom term.',
              )}
            </p>

            {/* Candidates grid */}
            {candidates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  {candidates.length}{' '}
                  {tr('imagini găsite - click pentru a selecta:', 'images found - click to select:')}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {candidates.map((c, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectCandidate(c.url)}
                      disabled={selecting !== null}
                      className={`relative group rounded-lg border-2 overflow-hidden transition-all aspect-square ${
                        selecting === c.url
                          ? 'border-blue-500 ring-2 ring-blue-500/50'
                          : 'border-gray-600 hover:border-blue-400'
                      } ${selecting !== null && selecting !== c.url ? 'opacity-50' : ''}`}
                    >
                      <img
                        src={c.url}
                        alt={`Candidat ${idx + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxMiI+RXJvYXJlPC90ZXh0Pjwvc3ZnPg==';
                        }}
                      />
                      {/* Confidence badge */}
                      <span
                        className={`absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          c.confidence === 'high'
                            ? 'bg-green-600/80 text-white'
                            : c.confidence === 'medium'
                              ? 'bg-yellow-600/80 text-white'
                              : 'bg-gray-600/80 text-gray-300'
                        }`}
                      >
                        {c.confidence === 'high'
                          ? tr('Bună', 'Good')
                          : c.confidence === 'medium'
                            ? tr('Medie', 'Medium')
                            : tr('Slabă', 'Low')}
                      </span>
                      {/* Loading overlay */}
                      {selecting === c.url && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <RefreshCw size={20} className="text-white animate-spin" />
                        </div>
                      )}
                      {/* Hover overlay */}
                      {selecting !== c.url && (
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="text-white text-xs font-medium bg-blue-600 px-2 py-1 rounded">
                            {tr('Selectează', 'Select')}
                          </span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state after search */}
            {searchDone && candidates.length === 0 && !error && (
              <div className="text-center py-8 text-gray-500">
                <Search size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{tr('Nu s-au găsit imagini', 'No images found')}</p>
                <p className="text-xs mt-1">
                  {tr('Încearcă un alt termen de căutare', 'Try a different search term')}
                </p>
              </div>
            )}

            {/* Initial state (before any search) */}
            {!searchDone && !searching && candidates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Search size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {tr(
                    'Apasă "Caută" pentru a găsi imagini automat',
                    'Press "Search" to find images automatically',
                  )}
                </p>
                <p className="text-xs mt-1">
                  {tr('Se va căuta pe baza SKU:', 'Search will use SKU:')}{' '}
                  <span className="text-gray-400">{product.sku}</span>
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Upload Tab ── */}
        {tab === 'upload' && (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-5 sm:p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-blue-400 bg-blue-400/10'
                  : preview
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              {preview ? (
                <div className="space-y-3">
                  <img
                    src={preview}
                    alt="Preview"
                    className="w-32 h-32 object-contain mx-auto rounded-lg border border-gray-600"
                  />
                  <p className="text-sm text-green-400">
                    {selectedFile?.name} ({((selectedFile?.size || 0) / 1024).toFixed(0)} KB)
                  </p>
                  <p className="text-xs text-gray-500">
                    {tr('Click pentru a schimba fișierul', 'Click to change file')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload size={40} className="mx-auto text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-300">
                      {tr('Trage și plasează o imagine aici', 'Drag and drop an image here')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {tr('sau click pentru a selecta un fișier', 'or click to select a file')}
                    </p>
                  </div>
                  <p className="text-xs text-gray-600">
                    {tr('JPG, PNG, WebP, GIF, SVG - max 5 MB', 'JPG, PNG, WebP, GIF, SVG - max 5 MB')}
                  </p>
                </div>
              )}
            </div>

            {/* Upload button */}
            {selectedFile && (
              <div className="flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      {tr('Se încarcă...', 'Uploading...')}
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      {tr('Salvează imaginea', 'Save image')}
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Error (shared between tabs) */}
        {error && (
          <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Close button */}
        <div className="flex justify-end pt-2 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
          >
            {tr('Închide', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Products Page
// ─────────────────────────────────────────────────────────────────────────────
// Products Page
// ─────────────────────────────────────────────────────────────────────────────

export function ProductsPage() {
  const { language } = useGlobalLanguage();
  const tr = (ro: string, en: string) => (language === 'ro' ? ro : en);
  const locale = language === 'ro' ? 'ro-RO' : 'en-US';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [cursorDirection, setCursorDirection] = useState<'next' | 'prev'>('next');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [hasPrevPage, setHasPrevPage] = useState(false);
  const [uploadProduct, setUploadProduct] = useState<Product | null>(null);
  const [, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Bulk image download state
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    searched: number;
    imported: number;
    notFound: number;
    errors: string[];
  } | null>(null);

  // Filter state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('Toate');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [appliedPriceMin, setAppliedPriceMin] = useState<number | null>(null);
  const [appliedPriceMax, setAppliedPriceMax] = useState<number | null>(null);
  const [categoryFacets, setCategoryFacets] = useState<CategoryFacet[]>([]);
  const [specificFilters, setSpecificFilters] = useState<Record<string, string[]>>({});
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [maytoniOnly, setMaytoniOnly] = useState(false);

  const extractSpecs = useCallback((product: Product) => {
    const specs = (product.specifications || {}) as Record<string, unknown>;
    const pick = (...values: unknown[]) =>
      values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

    return {
      wattage: pick(product.wattage, specs.wattage),
      ipRating: pick(product.ip_rating, product.ipRating, specs.ip_rating, specs.ipRating),
      kelvin: pick(product.color_temperature, product.colorTemperature, specs.color_temperature, specs.colorTemperature),
      lumens: pick(product.lumens, specs.lumens),
      cri: pick(product.cri, specs.cri),
      beamAngle: pick(product.beam_angle, product.beamAngle, specs.beam_angle, specs.beamAngle),
      voltageInput: pick(product.voltage_input, product.voltageInput, specs.voltage_input, specs.voltageInput),
      mountingType: pick(product.mounting_type, product.mountingType, specs.mounting_type, specs.mountingType),
    };
  }, []);

  const extractMaytoniResources = useCallback((product: Product) => {
    const specs = (product.specifications || {}) as Record<string, any>;
    const custom = (specs.custom_specs || {}) as Record<string, any>;
    const resources = (custom.resurse_maytoni || {}) as Record<string, any>;

    const links: Array<{ label: string; url: string }> = [];
    const add = (label: string, value: unknown) => {
      const normalized = String(value || '').trim();
      if (normalized.startsWith('http')) {
        links.push({ label, url: normalized });
      }
    };

    add('Instructiune', resources.instructiune_pdf || resources.instructiune_link || specs.instructiune_pdf);
    add('Eticheta energetica', resources.eticheta_energetica_pdf || resources.eticheta_energetica_imagine);
    add('Model 3D/360', resources.model_3d_360);
    add('Plan tehnic', resources.plan_tehnic_blueprint || resources.schema_web || specs.fisa_tehnica);

    return links;
  }, []);

  const selectedCategoryName = useMemo(() => {
    if (!categoryId) {
      return '';
    }

    return categories.find((c) => String(c.id) === categoryId)?.name || '';
  }, [categories, categoryId]);

  const activeSpecificFilterCount = useMemo(
    () => Object.values(specificFilters).filter((values) => values.length > 0).length,
    [specificFilters],
  );

  const getStatusLabel = useCallback(
    (status: string) => {
      const labels: Record<string, { ro: string; en: string }> = {
        Toate: { ro: 'Toate', en: 'All' },
        Normal: { ro: 'Normal', en: 'Normal' },
        Atentionare: { ro: 'Atenționare', en: 'Warning' },
        Critic: { ro: 'Critic', en: 'Critical' },
      };
      return labels[status]?.[language] || status;
    },
    [language],
  );

  // Table columns — defined here to access setUploadProduct
  const columns: Column<Product>[] = useMemo(
    () => [
      {
        key: 'imageUrl',
        label: tr('Imagine', 'Image'),
        width: '80px',
        render: (value, row) => (
          <div
            className="flex items-center justify-center cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              setUploadProduct(row);
            }}
            title={tr('Click pentru a schimba imaginea', 'Click to change image')}
          >
            {value ? (
              <div className="relative">
                <img
                  src={value as string}
                  alt={row.name}
                  className="w-10 h-10 object-cover rounded border border-border-primary group-hover:opacity-70 transition-opacity"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
                <div className="hidden w-10 h-10 bg-background-tertiary rounded border border-border-primary items-center justify-center">
                  <Package size={16} className="text-text-tertiary" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload size={14} className="text-white drop-shadow-lg" />
                </div>
              </div>
            ) : (
              <div className="w-10 h-10 bg-background-tertiary rounded border border-dashed border-gray-500 flex items-center justify-center group-hover:border-blue-400 group-hover:bg-blue-400/10 transition-all">
                <Upload
                  size={14}
                  className="text-gray-500 group-hover:text-blue-400 transition-colors"
                />
              </div>
            )}
          </div>
        ),
      },
      { key: 'name', label: tr('Nume produs', 'Product name'), sortable: true },
      { key: 'sku', label: 'SKU', sortable: true },
      {
        key: 'price',
        label: tr('Preț', 'Price'),
        sortable: true,
        render: (v) => (
          <span className="font-medium text-blue-400">
            {Number(v).toLocaleString(locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            RON
          </span>
        ),
      },
      { key: 'categoryName', label: tr('Categorie', 'Category'), sortable: true },
      {
        key: 'specifications',
        label: tr('Specificații tehnice', 'Technical specs'),
        render: (_value, row) => {
          const specs = extractSpecs(row);
          const chips: string[] = [];

          if (specs.wattage) chips.push(`${specs.wattage}W`);
          if (specs.ipRating) chips.push(String(specs.ipRating).toUpperCase());
          if (specs.kelvin) chips.push(`${specs.kelvin}K`);
          if (specs.lumens) chips.push(`${specs.lumens}lm`);
          if (specs.cri) chips.push(`CRI ${specs.cri}`);
          if (specs.beamAngle) chips.push(`${specs.beamAngle}°`);
          if (specs.voltageInput) chips.push(String(specs.voltageInput));
          if (specs.mountingType) chips.push(String(specs.mountingType));

          if (chips.length === 0) {
            return <span className="text-xs text-gray-500">{tr('Fără date', 'No data')}</span>;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {chips.slice(0, 4).map((chip) => (
                <span
                  key={chip}
                  className="inline-flex items-center rounded-full border border-gray-600 bg-gray-800 px-2 py-0.5 text-[11px] text-gray-200"
                >
                  {chip}
                </span>
              ))}
              {chips.length > 4 && (
                <span className="inline-flex items-center rounded-full border border-blue-700 bg-blue-900/30 px-2 py-0.5 text-[11px] text-blue-300">
                  +{chips.length - 4}
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: 'resources',
        label: tr('Resurse Maytoni', 'Maytoni resources'),
        render: (_value, row) => {
          const resources = extractMaytoniResources(row);
          if (resources.length === 0) {
            return <span className="text-xs text-gray-500">{tr('Fără resurse', 'No resources')}</span>;
          }

          return (
            <div className="flex flex-wrap items-center gap-2">
              {resources.map((resource) => (
                <a
                  key={`${row.id}-${resource.label}`}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-blue-700 bg-blue-900/30 px-2 py-0.5 text-[11px] text-blue-300 hover:bg-blue-900/50"
                >
                  {resource.label}
                </a>
              ))}
            </div>
          );
        },
      },
      {
        key: 'available',
        label: tr('Stoc local (SmartBill)', 'Local stock (SmartBill)'),
        sortable: true,
        render: (v) => <span className="font-medium">{Number(v).toLocaleString(locale)}</span>,
      },
      {
        key: 'supplierStock',
        label: tr('Stoc furnizor', 'Supplier stock'),
        sortable: true,
        render: (v, row) => (
          <span className="font-medium text-blue-400">
            {Number(v).toLocaleString(locale)}
            {Number(v) > 0 && row.supplierLeadTime
              ? language === 'ro'
                ? ` (${row.supplierLeadTime} zile)`
                : ` (${row.supplierLeadTime} days)`
              : ''}
          </span>
        ),
      },
      {
        key: 'totalStock',
        label: tr('Stoc total', 'Total stock'),
        sortable: true,
        render: (v) => Number(v).toLocaleString(locale),
      },
      {
        key: 'status',
        label: tr('Status', 'Status'),
        render: (v) => {
          const status = v as string;
          const statusMap: Record<string, 'pending' | 'processing' | 'completed'> = {
            Normal: 'completed',
            Atentionare: 'processing',
            Critic: 'pending',
          };
          return <StatusBadge status={statusMap[status] || 'pending'} label={getStatusLabel(status)} />;
        },
      },
    ],
    [extractMaytoniResources, extractSpecs, getStatusLabel, language, locale, tr],
  );

  // Fetch categories on mount
  useEffect(() => {
    apiClient
      .get('/b2b/products/categories')
      .then((res: any) => {
        const payload = res?.data || res;
        const tree = Array.isArray(payload?.categories)
          ? payload.categories
          : Array.isArray(payload?.data?.categories)
            ? payload.data.categories
            : [];

        const flat: Category[] = [];
        for (const root of tree) {
          if (root?.id && root?.name) {
            flat.push({ id: Number(root.id), name: String(root.name) });
          }
        }

        const unique = Array.from(new Map(flat.map((cat) => [cat.id, cat])).values());
        setCategories(unique);
      })
      .catch(() => {
        /* categories are optional */
      });
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '100',
      });
      if (cursor) {
        params.set('cursor', cursor);
        params.set('direction', cursorDirection);
      }
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (selectedCategoryName) {
        params.set('category', selectedCategoryName);
      }

      Object.entries(specificFilters).forEach(([key, values]) => {
        values.forEach((value) => params.append(key, value));
      });

      const response = await apiClient.get(`/inventory/products?${params.toString()}`);
      const data = (response as any)?.data || response;
      const pagination = data.pagination || {};

      setProducts(data.items || []);
      setTotalPages(pagination.totalPages || 1);
      setTotal(pagination.total || 0);
      setNextCursor(pagination.nextCursor || null);
      setPrevCursor(pagination.prevCursor || null);
      setHasNextPage(
        typeof pagination.hasNextPage === 'boolean'
          ? pagination.hasNextPage
          : page < (pagination.totalPages || 1),
      );
      setHasPrevPage(
        typeof pagination.hasPrevPage === 'boolean' ? pagination.hasPrevPage : page > 1,
      );
    } catch (err: any) {
      setError(err.message || tr('Eroare la încărcarea produselor', 'Failed to load products'));
      setProducts([]);
      setNextCursor(null);
      setPrevCursor(null);
      setHasNextPage(false);
      setHasPrevPage(page > 1);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedCategoryName, specificFilters, cursor, cursorDirection]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (!selectedCategoryName) {
      setCategoryFacets([]);
      setSpecificFilters({});
      return;
    }

    apiClient
      .get(`/inventory/products/facets?category=${encodeURIComponent(selectedCategoryName)}`)
      .then((res: any) => {
        const payload = res?.data || res;
        const facets = Array.isArray(payload?.facets)
          ? payload.facets
          : Array.isArray(payload?.data?.facets)
            ? payload.data.facets
            : [];

        const normalized: CategoryFacet[] = facets
          .map((facet: any) => ({
            key: String(facet?.key || '').trim(),
            label: String(facet?.label || '').trim(),
            options: Array.isArray(facet?.options)
              ? facet.options
                  .map((option: any) => ({
                    value: String(option?.value || '').trim(),
                    label: String(option?.label || option?.value || '').trim(),
                    count: Number(option?.count || 0),
                  }))
                  .filter((option: FacetOption) => option.value.length > 0)
              : [],
          }))
          .filter((facet: CategoryFacet) => facet.key && facet.label && facet.options.length > 0);

        setCategoryFacets(normalized);
        setSpecificFilters((prev) => {
          const next: Record<string, string[]> = {};
          const facetKeys = new Set(normalized.map((facet) => facet.key));

          for (const [key, values] of Object.entries(prev)) {
            if (facetKeys.has(key)) {
              next[key] = values;
            }
          }

          return next;
        });
      })
      .catch(() => {
        setCategoryFacets([]);
        setSpecificFilters({});
      });
  }, [selectedCategoryName]);

  const toggleSpecificFilter = (key: string, value: string) => {
    setPage(1);
    setCursor(null);
    setCursorDirection('next');
    setSpecificFilters((prev) => {
      const existing = prev[key] || [];
      const nextValues = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];

      return {
        ...prev,
        [key]: nextValues,
      };
    });
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (categoryId) count++;
    if (statusFilter !== 'Toate') count++;
    if (appliedPriceMin !== null || appliedPriceMax !== null) count++;
    if (maytoniOnly) count++;
    if (activeSpecificFilterCount > 0) count += activeSpecificFilterCount;
    if (sortBy !== 'name-asc') count++;
    return count;
  }, [
    categoryId,
    statusFilter,
    appliedPriceMin,
    appliedPriceMax,
    maytoniOnly,
    activeSpecificFilterCount,
    sortBy,
  ]);

  const resetFilters = () => {
    setCategoryId('');
    setStatusFilter('Toate');
    setPriceMin('');
    setPriceMax('');
    setAppliedPriceMin(null);
    setAppliedPriceMax(null);
    setMaytoniOnly(false);
    setSpecificFilters({});
    setSortBy('name-asc');
    setPage(1);
    setCursor(null);
    setCursorDirection('next');
  };

  const applyPriceFilter = () => {
    setPage(1);
    setCursor(null);
    setCursorDirection('next');
    setAppliedPriceMin(priceMin ? Number(priceMin) : null);
    setAppliedPriceMax(priceMax ? Number(priceMax) : null);
  };

  // ── Bulk auto-search images handler ──
  const handleBulkDownloadImages = async (ids: Set<string | number>) => {
    // Map selected stock_level IDs to productIds
    const productIds = filteredProducts.filter((p) => ids.has(p.id)).map((p) => p.productId);

    if (productIds.length === 0) return;

    setBulkDownloading(true);
    setBulkResult(null);
    try {
      const result = await inventoryService.bulkAutoSearchImages(productIds, {
        skipExisting: true,
      });
      setBulkResult(result);
      // Refresh products to show new images
      fetchProducts();
    } catch (err: any) {
      setBulkResult({
        searched: 0,
        imported: 0,
        notFound: 0,
        errors: [err.message || tr('Eroare la descărcarea automată a pozelor', 'Automatic image download failed')],
      });
    } finally {
      setBulkDownloading(false);
    }
  };

  // Client-side filtering + sorting
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Status filter
    if (statusFilter !== 'Toate') {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Price range filter
    if (appliedPriceMin !== null) {
      result = result.filter((p) => Number(p.price) >= appliedPriceMin);
    }
    if (appliedPriceMax !== null) {
      result = result.filter((p) => Number(p.price) <= appliedPriceMax);
    }

    if (maytoniOnly) {
      result = result.filter((p) => extractMaytoniResources(p).length > 0);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'price-asc':
          return Number(a.price) - Number(b.price);
        case 'price-desc':
          return Number(b.price) - Number(a.price);
        case 'stock-asc':
          return a.totalStock - b.totalStock;
        case 'stock-desc':
          return b.totalStock - a.totalStock;
        default:
          return 0;
      }
    });

    return result;
  }, [products, statusFilter, appliedPriceMin, appliedPriceMax, maytoniOnly, extractMaytoniResources, sortBy]);

  const exportMaytoniResourcesCsv = useCallback(() => {
    const rows = filteredProducts
      .map((product) => {
        const resources = extractMaytoniResources(product);
        if (resources.length === 0) return null;

        const specs = extractSpecs(product);
        const byLabel = new Map(resources.map((entry) => [entry.label, entry.url]));

        return {
          id: product.id,
          sku: product.sku,
          nume: product.name,
          stoc_local: product.localStock,
          stoc_furnizor: product.supplierStock,
          stoc_total: product.totalStock,
          putere_w: String(specs.wattage || ''),
          ip: String(specs.ipRating || ''),
          kelvin: String(specs.kelvin || ''),
          instructiune: byLabel.get('Instructiune') || '',
          eticheta_energetica: byLabel.get('Eticheta energetica') || '',
          model_3d_360: byLabel.get('Model 3D/360') || '',
          plan_tehnic: byLabel.get('Plan tehnic') || '',
        };
      })
      .filter(Boolean) as Array<Record<string, any>>;

    if (rows.length === 0) {
      setError(
        tr(
          'Nu exista produse Maytoni de exportat in filtrul curent.',
          'No Maytoni products to export in current filter.',
        ),
      );
      return;
    }

    const headers = Object.keys(rows[0]);
    const escapeCsv = (value: unknown) => {
      const text = String(value ?? '');
      if (text.includes('"') || text.includes(',') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `maytoni-resurse-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [extractMaytoniResources, extractSpecs, filteredProducts, tr]);

  return (
    <div className="p-3 sm:p-4 lg:p-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white">{tr('Produse', 'Products')}</h1>
          <p className="text-gray-300 mt-1">
            {tr('Catalog produse', 'Product catalog')} - {total.toLocaleString(locale)}{' '}
            {tr('produse', 'products')}
          </p>
        </div>
        <div className="flex w-full lg:w-auto flex-col sm:flex-row gap-3">
          <button
            className="btn-secondary flex items-center justify-center gap-2"
            onClick={exportMaytoniResourcesCsv}
          >
            <Download size={18} />
            {tr('Export resurse Maytoni', 'Export Maytoni resources')}
          </button>
          <button
            className="btn-primary flex items-center justify-center gap-2"
            onClick={fetchProducts}
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            {tr('Actualizează', 'Refresh')}
          </button>
          <button className="btn-primary flex items-center justify-center gap-2">
            <Plus size={18} />
            {tr('Adaugă produs', 'Add product')}
          </button>
        </div>
      </div>

      <div className="relative w-full sm:max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={tr('Caută după SKU sau nume produs...', 'Search by SKU or product name...')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
            setCursor(null);
            setCursorDirection('next');
          }}
          className="w-full pl-10 pr-4 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-col xl:flex-row xl:flex-wrap gap-3 xl:items-center">
        <Filter size={16} className="text-gray-400" />

        {/* Category dropdown */}
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setSpecificFilters({});
            setPage(1);
            setCursor(null);
            setCursorDirection('next');
          }}
          className="w-full sm:w-auto bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">{tr('Toate categoriile', 'All categories')}</option>
          {categories.map((cat) => (
            <option key={cat.id} value={String(cat.id)}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Status pill buttons */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {getStatusLabel(s)}
            </button>
          ))}
        </div>

        {/* Price range */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-400">{tr('Preț:', 'Price:')}</span>
          <input
            type="number"
            placeholder={tr('Min', 'Min')}
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-24 sm:w-28 bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-gray-500">-</span>
          <input
            type="number"
            placeholder={tr('Max', 'Max')}
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-24 sm:w-28 bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-xs text-gray-500">RON</span>
          <button
            onClick={applyPriceFilter}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            {tr('Aplică', 'Apply')}
          </button>
        </div>

        <button
          onClick={() => setMaytoniOnly((prev) => !prev)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
            maytoniOnly
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {tr('Doar cu resurse Maytoni', 'Only with Maytoni resources')}
        </button>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="w-full sm:w-auto bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {(Object.entries(SORT_LABELS) as [SortOption, { ro: string; en: string }][]).map(
            ([key, label]) => (
            <option key={key} value={key}>
              {label[language]}
            </option>
            ),
          )}
        </select>

        {/* Active filter count + reset */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 xl:ml-auto">
            <span className="text-sm text-blue-400 font-medium">
              {activeFilterCount}{' '}
              {activeFilterCount === 1
                ? tr('filtru activ', 'active filter')
                : tr('filtre active', 'active filters')}
            </span>
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <X size={14} />
              {tr('Resetează filtre', 'Reset filters')}
            </button>
          </div>
        )}
      </div>

      {selectedCategoryName && categoryFacets.length > 0 && (
        <div className="rounded-lg border border-blue-800/50 bg-blue-950/20 p-3 space-y-3">
          <p className="text-sm font-medium text-blue-300">
            {tr('Filtre specifice', 'Specific filters')} - {selectedCategoryName}
          </p>

          {categoryFacets.map((facet) => {
            const selectedValues = specificFilters[facet.key] || [];
            return (
              <div key={facet.key} className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-gray-400">{facet.label}</p>
                <div className="flex flex-wrap gap-2">
                  {facet.options.map((option) => {
                    const selected = selectedValues.includes(option.value);
                    return (
                      <button
                        key={`${facet.key}:${option.value}`}
                        onClick={() => toggleSpecificFilter(facet.key, option.value)}
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                          selected
                            ? 'bg-blue-600 text-white border border-blue-500'
                            : 'bg-gray-800 text-gray-300 border border-gray-600 hover:bg-gray-700'
                        }`}
                      >
                        {option.label} ({option.count})
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filtered count info */}
      {activeFilterCount > 0 && !loading && (
        <p className="text-sm text-gray-400">
          {filteredProducts.length} {tr('din', 'of')} {products.length} {tr('produse afișate', 'products shown')}
        </p>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-300" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={
            <div className="text-4xl">
              <Package size={40} />
            </div>
          }
          title={
            search || activeFilterCount > 0
              ? tr('Nu s-au găsit produse', 'No products found')
              : tr('Niciun produs', 'No products')
          }
          description={
            search || activeFilterCount > 0
              ? tr('Încearcă să modifici filtrele sau termenul de căutare', 'Try adjusting filters or search term')
              : tr('Datele de produs vor apărea aici după sincronizare', 'Product data will appear here after sync')
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filteredProducts}
            selectable
            onSelectionChange={setSelectedIds}
            bulkActions={(ids) => (
              <button
                onClick={() => handleBulkDownloadImages(ids)}
                disabled={bulkDownloading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bulkDownloading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    {tr('Se descarcă pozele...', 'Downloading images...')}
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    {tr('Descarcă poze automat', 'Auto-download images')}
                  </>
                )}
              </button>
            )}
          />

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-300">
                {tr('Pagina', 'Page')} {page} {tr('din', 'of')} {totalPages} ({total.toLocaleString(locale)}{' '}
                {tr('produse', 'products')})
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={!hasPrevPage}
                  onClick={() => {
                    if (prevCursor) {
                      setCursor(prevCursor);
                      setCursorDirection('prev');
                    } else {
                      setCursor(null);
                    }
                    setPage((p) => Math.max(1, p - 1));
                  }}
                >
                  {tr('Anterior', 'Previous')}
                </button>
                <button
                  className="btn-secondary"
                  disabled={!hasNextPage}
                  onClick={() => {
                    if (nextCursor) {
                      setCursor(nextCursor);
                      setCursorDirection('next');
                    } else {
                      setCursor(null);
                    }
                    setPage((p) => p + 1);
                  }}
                >
                  {tr('Următor', 'Next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Image Upload Modal */}
      <ImageUploadModal
        product={uploadProduct}
        onClose={() => setUploadProduct(null)}
        onUploaded={(productId, imageUrl) => {
          // Update product imageUrl in local state to avoid full refetch
          setProducts((prev) =>
            prev.map((p) => (p.productId === productId ? { ...p, imageUrl } : p)),
          );
        }}
      />

      {/* Bulk Download Result Modal */}
      {bulkResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBulkResult(null);
          }}
        >
          <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Image size={20} />
                {tr('Rezultat descărcare poze', 'Image download result')}
              </h3>
              <button
                onClick={() => setBulkResult(null)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">{bulkResult.searched}</p>
                  <p className="text-xs text-gray-400 mt-1">{tr('Căutate', 'Searched')}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{bulkResult.imported}</p>
                  <p className="text-xs text-gray-400 mt-1">{tr('Importate', 'Imported')}</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{bulkResult.notFound}</p>
                  <p className="text-xs text-gray-400 mt-1">{tr('Negăsite', 'Not found')}</p>
                </div>
              </div>

              {bulkResult.imported > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-700 rounded-lg text-sm text-green-400">
                  <CheckCircle size={16} />
                  {bulkResult.imported}{' '}
                  {tr(
                    'imagini au fost descărcate și salvate cu succes.',
                    'images were downloaded and saved successfully.',
                  )}
                </div>
              )}

              {bulkResult.errors.length > 0 && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg space-y-1">
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {bulkResult.errors.length} {tr('erori:', 'errors:')}
                  </p>
                  <ul className="text-xs text-red-400/80 list-disc pl-5 max-h-32 overflow-y-auto">
                    {bulkResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-700">
              <button
                onClick={() => setBulkResult(null)}
                className="px-4 py-2 text-sm text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
              >
                {tr('Închide', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
