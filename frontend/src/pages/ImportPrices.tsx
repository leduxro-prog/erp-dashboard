import React, { useState } from 'react';
import {
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  X,
} from 'lucide-react';
import { apiClient } from '@/services/api';

interface ImportResult {
  totalRows: number;
  validRows: number;
  productsUpdated: number;
  productsNotFound: number;
  errors: Array<{ row: number; sku: string; error: string }>;
  preview: Array<{ sku: string; name: string; oldPrice: number; newPrice: number }>;
}

export default function ImportPrices() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [skuColumn, setSkuColumn] = useState('');
  const [priceColumn, setPriceColumn] = useState('');
  const [vatRate, setVatRate] = useState('19');
  const [priceIncludesVat, setPriceIncludesVat] = useState(true);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Vă rugăm să selectați un fișier');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dryRun', String(dryRun));
      if (skuColumn) formData.append('skuColumn', skuColumn);
      if (priceColumn) formData.append('priceColumn', priceColumn);
      if (vatRate) formData.append('vatRate', vatRate);
      formData.append('priceIncludesVat', String(priceIncludesVat));

      const token = apiClient.getToken();
      const response = await fetch('/api/v1/smartbill/import-prices', {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setResult(data.data);
    } catch (err: any) {
      setError(err.message || 'Eroare la încărcarea fișierului');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = apiClient.getToken();
      const response = await fetch('/api/v1/smartbill/template', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'price-import-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Eroare la descărcarea template-ului');
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-text-primary">Import Prețuri din Excel</h1>
        <p className="text-text-secondary mt-1">Actualizează prețurile produselor din fișiere Excel</p>
      </div>

      {/* Instructions Card */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 text-blue-600">
          <Info size={20} />
          <h2 className="text-lg font-semibold">Instrucțiuni</h2>
        </div>
        <div className="space-y-2 text-sm text-text-secondary">
          <p>1. Descărcați template-ul Excel și completați-l cu prețurile produselor</p>
          <p>2. Asigurați-vă că fișierul conține coloanele: <strong>Cod produs</strong> și <strong>Pret</strong></p>
          <p>3. Folosiți "Preview" pentru a verifica înainte de import</p>
        </div>
        <button
          onClick={handleDownloadTemplate}
          className="btn-secondary flex items-center gap-2"
        >
          <Download size={18} />
          Descarcă Template Excel
        </button>
      </div>

      {/* Upload Card */}
      <div className="card p-6 space-y-6">
        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">
            Fișier Excel
          </label>
          <div className="flex items-center gap-3">
            <label className="btn-primary flex items-center gap-2 cursor-pointer">
              <Upload size={18} />
              Selectează Fișier Excel
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
              />
            </label>
            {file && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg">
                <span className="text-sm font-medium">{file.name}</span>
                <button
                  onClick={() => setFile(null)}
                  className="text-blue-500 hover:text-blue-700"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Coloană SKU (opțional)
            </label>
            <input
              type="text"
              className="input w-full"
              value={skuColumn}
              onChange={(e) => setSkuColumn(e.target.value)}
              placeholder="Lasă gol pentru detectare automată"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Coloană Preț (opțional)
            </label>
            <input
              type="text"
              className="input w-full"
              value={priceColumn}
              onChange={(e) => setPriceColumn(e.target.value)}
              placeholder="Lasă gol pentru detectare automată"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              TVA (%)
            </label>
            <input
              type="number"
              className="input w-full"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={priceIncludesVat}
                onChange={(e) => setPriceIncludesVat(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-text-primary">Prețul include TVA</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="w-4 h-4 text-yellow-600 rounded focus:ring-2 focus:ring-yellow-500"
              />
              <span className="text-sm font-medium text-text-primary">
                {dryRun ? 'Preview (fără modificări)' : 'Import REAL'}
              </span>
            </label>
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
            dryRun
              ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300'
              : 'bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300'
          }`}
        >
          {loading ? 'Se procesează...' : dryRun ? 'Preview Import' : 'IMPORT PREȚURI'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="card p-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '50%' }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="card p-4 border-l-4 border-red-500 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <div className="flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold mb-4">
              {dryRun ? '📋 Preview Rezultate' : '✅ Rezultate Import'}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-text-secondary mb-1">Total Rânduri</p>
                <p className="text-2xl font-bold">{result.totalRows}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Rânduri Valide</p>
                <p className="text-2xl font-bold text-green-600">{result.validRows}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">
                  {dryRun ? 'Vor fi actualizate' : 'Produse Actualizate'}
                </p>
                <p className="text-2xl font-bold text-blue-600">{result.productsUpdated}</p>
              </div>
              <div>
                <p className="text-xs text-text-secondary mb-1">Nu s-au găsit</p>
                <p className="text-2xl font-bold text-yellow-600">{result.productsNotFound}</p>
              </div>
            </div>
          </div>

          {/* Preview Table */}
          {result.preview.length > 0 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold">Preview Prețuri (primele 20)</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Nume Produs</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Preț Vechi</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Preț Nou</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary">Diferență</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.preview.map((item, index) => {
                      const diff = item.newPrice - item.oldPrice;
                      const diffPercent = item.oldPrice > 0 ? ((diff / item.oldPrice) * 100).toFixed(1) : 'N/A';
                      return (
                        <tr key={index} className="hover:bg-surface-secondary/50">
                          <td className="px-4 py-3 text-sm">{item.sku}</td>
                          <td className="px-4 py-3 text-sm">{item.name}</td>
                          <td className="px-4 py-3 text-sm text-right">{item.oldPrice.toFixed(2)} RON</td>
                          <td className="px-4 py-3 text-sm text-right">{item.newPrice.toFixed(2)} RON</td>
                          <td className="px-4 py-3 text-right">
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                                diff >= 0
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {diff >= 0 ? '+' : ''}{diff.toFixed(2)} RON ({diffPercent}%)
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="card overflow-hidden border-l-4 border-red-500">
              <div className="p-4 border-b bg-red-50">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle size={20} />
                  <h3 className="font-semibold">Erori ({result.errors.length})</h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-secondary">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Rând</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">SKU</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary">Eroare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {result.errors.slice(0, 20).map((err, index) => (
                      <tr key={index} className="hover:bg-surface-secondary/50">
                        <td className="px-4 py-3 text-sm">{err.row}</td>
                        <td className="px-4 py-3 text-sm">{err.sku}</td>
                        <td className="px-4 py-3 text-sm text-red-600">{err.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.errors.length > 20 && (
                <div className="p-4 text-sm text-text-secondary">
                  ... și încă {result.errors.length - 20} erori
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
