import { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import { DataTable, Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { apiClient } from '@/services/api';

interface Product {
  id: number;
  name: string;
  sku: string;
  category_id?: number;
  base_price: number;
  stock?: number;
  is_active: boolean;
}

const columns: Column<Product>[] = [
  { key: 'name', label: 'Nume Produs', sortable: true },
  { key: 'sku', label: 'SKU', sortable: true },
  {
    key: 'base_price',
    label: 'Preț',
    sortable: true,
    render: (v) => `${Number(v).toFixed(2)} EUR`
  },
  {
    key: 'stock',
    label: 'Stoc',
    sortable: true,
    render: (v) => v !== undefined ? v : '-'
  },
  {
    key: 'is_active',
    label: 'Status',
    render: (v) => v ? 'Activ' : 'Inactiv'
  }
];

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchProducts();
  }, [page, search]);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      if (search) params.set('search', search);

      const response = await apiClient.get(`/inventory/products?${params.toString()}`);

      if (response.success) {
        setProducts(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
      } else {
        setError('Nu s-au putut încărca produsele');
      }
    } catch (err: any) {
      setError(err.message || 'Eroare la încărcarea produselor');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-text-primary">Produse</h1>
          <p className="text-text-secondary mt-1">Catalog produse</p>
        </div>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Adaugă Produs
        </button>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-tertiary" size={18} />
          <input
            type="text"
            placeholder="Caută produse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background-secondary border border-border-primary rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-2 text-text-secondary">Se încarcă produsele...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12 text-error">{error}</div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<div className="text-4xl">📦</div>}
          title="Niciun Produs"
          description="Nu s-au găsit produse."
          action={{ label: 'Adaugă Produs', onClick: () => {} }}
        />
      ) : (
        <DataTable columns={columns} data={products} selectable />
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-background-secondary border border-border-primary rounded disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="px-4 py-2">
            Pagina {page} din {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-background-secondary border border-border-primary rounded disabled:opacity-50"
          >
            Următorul
          </button>
        </div>
      )}
    </div>
  );
}
