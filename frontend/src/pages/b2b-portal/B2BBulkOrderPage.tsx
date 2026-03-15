import React, { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { 
  FileText, Upload, Plus, Trash2, ShoppingCart, 
  Search, AlertCircle, CheckCircle2, Loader2, Info
} from 'lucide-react';
import { b2bApi } from '../../services/b2b-api';
import { useCartStore } from '../../stores/cart.store';

interface BulkItem {
  sku: string;
  quantity: number;
  loading?: boolean;
  product?: any;
  error?: string;
}

export const B2BQuickOrderPage: React.FC = () => {
  const [items, setItems] = useState<BulkItem[]>([{ sku: '', quantity: 1 }]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { addItem } = useCartStore();

  const handleAddRow = () => {
    setItems([...items, { sku: '', quantity: 1 }]);
  };

  const handleRemoveRow = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    if (newItems.length === 0) newItems.push({ sku: '', quantity: 1 });
    setItems(newItems);
  };

  const handleUpdateItem = (index: number, field: keyof BulkItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const validateSku = async (index: number) => {
    const sku = items[index].sku.trim();
    if (!sku) return;

    handleUpdateItem(index, 'loading', true);
    handleUpdateItem(index, 'error', undefined);

    try {
      const response = await b2bApi.getProducts({ search: sku, limit: 1 });
      const product = response.products?.[0];

      if (product && product.sku.toLowerCase() === sku.toLowerCase()) {
        handleUpdateItem(index, 'product', product);
      } else {
        handleUpdateItem(index, 'error', 'SKU negăsit');
        handleUpdateItem(index, 'product', undefined);
      }
    } catch (err) {
      handleUpdateItem(index, 'error', 'Eroare validare');
    } finally {
      handleUpdateItem(index, 'loading', false);
    }
  };

  const handleAddToCart = () => {
    const validItems = items.filter(i => i.product && !i.error);
    if (validItems.length === 0) {
      toast.error('Adăugați cel puțin un produs valid.');
      return;
    }

    validItems.forEach(item => {
      addItem({
        productId: item.product.id,
        sku: item.product.sku,
        name: item.product.name,
        price: item.product.price,
        currency: item.product.currency,
        image_url: item.product.image_url,
      }, item.quantity);
    });

    toast.success(`${validItems.length} produse adăugate în coș.`);
    setItems([{ sku: '', quantity: 1 }]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const result = await b2bApi.importCSV(file);
      
      const newItems: BulkItem[] = result.valid_items.map(v => ({
        sku: v.sku,
        quantity: v.quantity,
        product: {
          id: v.product_id,
          sku: v.sku,
          name: v.product_name,
          price: v.unit_price,
          currency: 'RON',
        }
      }));

      if (result.invalid_items.length > 0) {
        toast.error(`${result.invalid_items.length} SKUs nu au putut fi importate.`);
        const invalid: BulkItem[] = result.invalid_items.map(i => ({
          sku: i.sku,
          quantity: i.quantity,
          error: i.reason
        }));
        setItems([...newItems, ...invalid]);
      } else {
        setItems(newItems.length > 0 ? newItems : [{ sku: '', quantity: 1 }]);
        toast.success('Import reușit!');
      }
    } catch (err) {
      toast.error('Eroare la procesarea fișierului CSV.');
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
          <ShoppingCart className="text-blue-600" />
          Comandă Rapidă B2B
        </h1>
        <p className="text-slate-500 mt-1">Introduceți codurile SKU sau importați un fișier CSV pentru a plasa comanda instant.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Manual Entry */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
              <h3 className="font-bold text-slate-800">Introducere Manuală</h3>
              <button 
                onClick={handleAddRow}
                className="text-blue-600 hover:text-blue-700 font-bold text-sm flex items-center gap-1"
              >
                <Plus size={16} /> Adaugă Rând
              </button>
            </div>
            
            <div className="p-0">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] uppercase font-black text-slate-400 tracking-widest">
                  <tr>
                    <th className="px-6 py-3">Cod SKU</th>
                    <th className="px-6 py-3 w-24 text-center">Cantitate</th>
                    <th className="px-6 py-3">Produs / Status</th>
                    <th className="px-6 py-3 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <input 
                          type="text"
                          value={item.sku}
                          onChange={(e) => handleUpdateItem(idx, 'sku', e.target.value)}
                          onBlur={() => validateSku(idx)}
                          placeholder="Ex: LED-PANEL-60"
                          className="w-full bg-transparent font-mono text-sm font-bold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full text-center font-bold text-slate-700 outline-none bg-slate-100/50 rounded-lg py-1"
                        />
                      </td>
                      <td className="px-6 py-4">
                        {item.loading ? (
                          <div className="flex items-center gap-2 text-slate-400">
                            <Loader2 size={14} className="animate-spin" />
                            <span className="text-xs italic">Se verifică...</span>
                          </div>
                        ) : item.error ? (
                          <div className="flex items-center gap-2 text-red-500">
                            <AlertCircle size={14} />
                            <span className="text-xs font-bold">{item.error}</span>
                          </div>
                        ) : item.product ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-800 line-clamp-1">{item.product.name}</span>
                            <div className="flex items-center gap-3 text-[10px]">
                              <span className="text-blue-600 font-bold">{item.product.price} {item.product.currency}</span>
                              <span className={item.product.stock_local > 0 ? 'text-green-600' : 'text-orange-500'}>
                                Stoc: {item.product.stock_local}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-300 italic">Introduceți un SKU valid</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleRemoveRow(idx)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <Info size={14} />
                <span>Apăsați TAB pentru a trece la următorul rând.</span>
              </div>
              <button 
                onClick={handleAddToCart}
                disabled={items.filter(i => i.product).length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-8 py-3 rounded-2xl font-black shadow-lg shadow-blue-100 transition-all flex items-center gap-2"
              >
                <Plus size={18} /> Adaugă tot în Coș
              </button>
            </div>
          </div>
        </div>

        {/* CSV Import & Templates */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-8 text-white shadow-2xl">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Upload className="text-blue-400" />
              Import CSV
            </h3>
            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Dacă aveți un necesar mare, încărcați un fișier CSV cu formatul: <code className="text-blue-300 font-bold">sku,cantitate</code>
            </p>
            
            <label className={`
              w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all
              ${isImporting ? 'bg-white/5 border-white/10 opacity-50 cursor-wait' : 'border-white/10 hover:border-blue-500 hover:bg-white/5'}
            `}>
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={isImporting}
              />
              {isImporting ? (
                <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
              ) : (
                <Upload className="w-10 h-10 text-slate-500" />
              )}
              <span className="font-bold text-sm">{isImporting ? 'Se procesează...' : 'Alege fișierul'}</span>
            </label>

            <div className="mt-8 pt-8 border-t border-white/5">
              <h4 className="font-bold text-sm mb-3">Descărcare model</h4>
              <a 
                href="/templates/b2b_bulk_order_template.csv" 
                className="text-xs text-blue-400 hover:underline flex items-center gap-2"
              >
                <FileText size={14} /> Model_Comanda_Bulk.csv
              </a>
            </div>
          </div>

          <div className="bg-blue-50 rounded-[2rem] p-8 border border-blue-100">
            <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
              <CheckCircle2 className="text-blue-600" />
              Avantaje Enterprise
            </h3>
            <ul className="space-y-3 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span>Validare stoc instantanee</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span>Aplicare automată a discountului de volum</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                <span>Integrare cu liste de proiecte</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
