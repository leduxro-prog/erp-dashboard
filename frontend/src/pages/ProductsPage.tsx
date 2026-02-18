import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus,
  Search,
  Package,
  RefreshCw,
  Filter,
  X,
  Upload,
  Trash2,
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
}

interface Category {
  id: number;
  name: string;
  slug?: string;
}

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'price-asc'
  | 'price-desc'
  | 'stock-asc'
  | 'stock-desc';

const SORT_LABELS: Record<SortOption, string> = {
  'name-asc': 'Nume A-Z',
  'name-desc': 'Nume Z-A',
  'price-asc': 'Pret crescator',
  'price-desc': 'Pret descrescator',
  'stock-asc': 'Stoc crescator',
  'stock-desc': 'Stoc descrescator',
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
      setError('Format invalid. Doar JPG, PNG, WebP, GIF, SVG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Fisierul depaseste 5 MB.');
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
      setError(err.message || 'Eroare la upload');
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
        setError('Nu s-au gasit imagini. Incercati un termen de cautare diferit.');
      }
    } catch (err: any) {
      setError(err.message || 'Eroare la cautare');
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
      setError(err.message || 'Eroare la salvarea imaginii');
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
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-full max-w-2xl mx-4 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Image size={20} />
              Imagine Produs
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
              <p className="text-sm text-gray-300">Imagine curenta</p>
              <p className="text-xs text-gray-500 truncate">{product.imageUrl}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
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
              Cautare Automata
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
              Upload Manual
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
                placeholder="Cauta dupa SKU, denumire, cod produs..."
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
                    Se cauta...
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    Cauta
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Lasa campul gol pentru cautare automata pe baza SKU-ului si denumirii produsului, sau
              introdu un termen personalizat.
            </p>

            {/* Candidates grid */}
            {candidates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-300">
                  {candidates.length} imagini gasite — click pentru a selecta:
                </p>
                <div className="grid grid-cols-3 gap-3">
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
                          ? 'Buna'
                          : c.confidence === 'medium'
                            ? 'Medie'
                            : 'Slaba'}
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
                            Selecteaza
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
                <p className="text-sm">Nu s-au gasit imagini</p>
                <p className="text-xs mt-1">Incercati un alt termen de cautare</p>
              </div>
            )}

            {/* Initial state (before any search) */}
            {!searchDone && !searching && candidates.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Search size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Apasati "Cauta" pentru a gasi imagini automat</p>
                <p className="text-xs mt-1">
                  Se va cauta pe baza SKU: <span className="text-gray-400">{product.sku}</span>
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
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
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
                  <p className="text-xs text-gray-500">Click pentru a schimba fisierul</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload size={40} className="mx-auto text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-300">Trage si plaseaza o imagine aici</p>
                    <p className="text-xs text-gray-500 mt-1">
                      sau click pentru a selecta un fisier
                    </p>
                  </div>
                  <p className="text-xs text-gray-600">JPG, PNG, WebP, GIF, SVG — max 5 MB</p>
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
                      Se incarca...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Salveaza Imaginea
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
            Inchide
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
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [uploadProduct, setUploadProduct] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

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
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');

  // Table columns — defined here to access setUploadProduct
  const columns: Column<Product>[] = useMemo(
    () => [
      {
        key: 'imageUrl',
        label: 'Imagine',
        width: '80px',
        render: (value, row) => (
          <div
            className="flex items-center justify-center cursor-pointer group"
            onClick={(e) => {
              e.stopPropagation();
              setUploadProduct(row);
            }}
            title="Click pentru a schimba imaginea"
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
      { key: 'name', label: 'Nume Produs', sortable: true },
      { key: 'sku', label: 'SKU', sortable: true },
      {
        key: 'price',
        label: 'Pret',
        sortable: true,
        render: (v) => (
          <span className="font-medium text-blue-400">
            {Number(v).toLocaleString('ro-RO', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            RON
          </span>
        ),
      },
      { key: 'categoryName', label: 'Categorie', sortable: true },
      {
        key: 'available',
        label: 'Stoc Local (SmartBill)',
        sortable: true,
        render: (v) => <span className="font-medium">{Number(v).toLocaleString()}</span>,
      },
      {
        key: 'supplierStock',
        label: 'Stoc Furnizor',
        sortable: true,
        render: (v, row) => (
          <span className="font-medium text-blue-400">
            {Number(v).toLocaleString()}
            {Number(v) > 0 && row.supplierLeadTime ? ` (${row.supplierLeadTime} zile)` : ''}
          </span>
        ),
      },
      {
        key: 'totalStock',
        label: 'Stoc Total',
        sortable: true,
        render: (v) => Number(v).toLocaleString(),
      },
      {
        key: 'status',
        label: 'Status',
        render: (v) => {
          const status = v as string;
          const statusMap: Record<string, 'pending' | 'processing' | 'completed'> = {
            Normal: 'completed',
            Atentionare: 'processing',
            Critic: 'pending',
          };
          return <StatusBadge status={statusMap[status] || 'pending'} label={status} />;
        },
      },
    ],
    [],
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
        limit: '500',
      });
      if (search) params.set('search', search);

      const response = await apiClient.get(`/inventory/products?${params.toString()}`);
      const data = (response as any)?.data || response;

      setProducts(data.items || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotal(data.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Eroare la incarcarea produselor');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (categoryId) count++;
    if (statusFilter !== 'Toate') count++;
    if (appliedPriceMin !== null || appliedPriceMax !== null) count++;
    if (sortBy !== 'name-asc') count++;
    return count;
  }, [categoryId, statusFilter, appliedPriceMin, appliedPriceMax, sortBy]);

  const resetFilters = () => {
    setCategoryId('');
    setStatusFilter('Toate');
    setPriceMin('');
    setPriceMax('');
    setAppliedPriceMin(null);
    setAppliedPriceMax(null);
    setSortBy('name-asc');
  };

  const applyPriceFilter = () => {
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
        errors: [err.message || 'Eroare la descarcarea automata a pozelor'],
      });
    } finally {
      setBulkDownloading(false);
    }
  };

  // Client-side filtering + sorting
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filter
    if (categoryId) {
      const cat = categories.find((c) => String(c.id) === categoryId);
      if (cat) {
        result = result.filter(
          (p) =>
            String(p.categoryId ?? '') === categoryId ||
            p.categoryName.toLowerCase() === cat.name.toLowerCase(),
        );
      }
    }

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
  }, [products, categoryId, categories, statusFilter, appliedPriceMin, appliedPriceMax, sortBy]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white">Produse</h1>
          <p className="text-gray-300 mt-1">Catalog produse — {total.toLocaleString()} produse</p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={fetchProducts}
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Actualizeaza
          </button>
          <button className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Adauga Produs
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Cauta dupa SKU sau nume produs..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-4 py-2 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter size={16} className="text-gray-400" />

        {/* Category dropdown */}
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Toate categoriile</option>
          {categories.map((cat) => (
            <option key={cat.id} value={String(cat.id)}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Status pill buttons */}
        <div className="flex gap-1">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Price range */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Pret:</span>
          <input
            type="number"
            placeholder="Min"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
            className="w-24 bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-gray-500">-</span>
          <input
            type="number"
            placeholder="Max"
            value={priceMax}
            onChange={(e) => setPriceMax(e.target.value)}
            className="w-24 bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-xs text-gray-500">RON</span>
          <button
            onClick={applyPriceFilter}
            className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Aplica
          </button>
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="bg-gray-800 text-white border border-gray-600 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        {/* Active filter count + reset */}
        {activeFilterCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-blue-400 font-medium">
              {activeFilterCount} {activeFilterCount === 1 ? 'filtru activ' : 'filtre active'}
            </span>
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-400 hover:text-red-300 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
            >
              <X size={14} />
              Reset Filtre
            </button>
          </div>
        )}
      </div>

      {/* Filtered count info */}
      {activeFilterCount > 0 && !loading && (
        <p className="text-sm text-gray-400">
          {filteredProducts.length} din {products.length} produse afisate
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
          title={search || activeFilterCount > 0 ? 'Nu s-au gasit produse' : 'Niciun Produs'}
          description={
            search || activeFilterCount > 0
              ? 'Incearca sa modifici filtrele sau termenul de cautare'
              : 'Datele de produs vor aparea aici dupa sincronizare'
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
                    Se descarca pozele...
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    Descarca Poze Automat
                  </>
                )}
              </button>
            )}
          />

          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
              <p className="text-sm text-gray-300">
                Pagina {page} din {totalPages} ({total.toLocaleString()} produse)
              </p>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </button>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Urmator
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
                Rezultat Descărcare Poze
              </h3>
              <button
                onClick={() => setBulkResult(null)}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-blue-400">{bulkResult.searched}</p>
                  <p className="text-xs text-gray-400 mt-1">Cautate</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-400">{bulkResult.imported}</p>
                  <p className="text-xs text-gray-400 mt-1">Importate</p>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-yellow-400">{bulkResult.notFound}</p>
                  <p className="text-xs text-gray-400 mt-1">Negasite</p>
                </div>
              </div>

              {bulkResult.imported > 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-700 rounded-lg text-sm text-green-400">
                  <CheckCircle size={16} />
                  {bulkResult.imported} imagini au fost descarcate si salvate cu succes.
                </div>
              )}

              {bulkResult.errors.length > 0 && (
                <div className="p-3 bg-red-900/30 border border-red-700 rounded-lg space-y-1">
                  <p className="text-sm text-red-400 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {bulkResult.errors.length} erori:
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
                Inchide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
