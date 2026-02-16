import React, { useState } from 'react';
import { Plus, Edit2, Copy, Trash2 } from 'lucide-react';

const ConfiguratorsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('builders');

  const configurators = [
    { id: 1, name: 'Laptop Configurator', product: 'LAPTOP-001', active: true, price_range: '3500-8500 RON' },
    { id: 2, name: 'Monitor Setup Builder', product: 'MON-027-4K', active: true, price_range: '1500-4200 RON' },
    { id: 3, name: 'PC Build Assistant', product: 'Mixed', active: false, price_range: '5000-25000 RON' },
  ];

  const variantRules = [
    { id: 1, product: 'LAPTOP-001', attribute: 'RAM', values: ['8GB', '16GB', '32GB'], price_modifier: [0, 500, 1200] },
    { id: 2, product: 'LAPTOP-001', attribute: 'Storage', values: ['256GB SSD', '512GB SSD', '1TB SSD'], price_modifier: [0, 300, 800] },
    { id: 3, product: 'LAPTOP-001', attribute: 'Processor', values: ['Intel i5', 'Intel i7', 'Intel i9'], price_modifier: [0, 1000, 3000] },
  ];

  const pricingCalculations = [
    { configurator: 'Laptop Config', base_price: 3500, total_modifiers: 1800, final_price: 5300 },
    { configurator: 'Monitor Setup', base_price: 1500, total_modifiers: 450, final_price: 1950 },
  ];

  return (
    <div className="p-8 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Product Configurators</h1>
        <button className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Configurator Nou
        </button>
      </div>

      {/* Tabs */}
      <div className="card mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { id: 'builders', label: 'Configuratori' },
            { id: 'rules', label: 'Variante & Reguli' },
            { id: 'pricing', label: 'Calcul Pret' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Builders Tab */}
      {activeTab === 'builders' && (
        <div className="space-y-4">
          {configurators.map(conf => (
            <div key={conf.id} className="card">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{conf.name}</h3>
                  <p className="text-sm text-slate-600">{conf.product} • {conf.price_range}</p>
                </div>
                <span className={`${conf.active ? 'badge-success' : 'badge-warning'}`}>
                  {conf.active ? 'Activ' : 'Inactiv'}
                </span>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Edit2 size={16} />
                  Editare
                </button>
                <button className="btn-secondary flex-1 flex items-center justify-center gap-2">
                  <Copy size={16} />
                  Duplicare
                </button>
                <button className="btn-secondary">
                  <Trash2 size={16} className="text-red-600" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produs</th>
                  <th>Atribut</th>
                  <th>Valori</th>
                  <th>Modificare Pret</th>
                </tr>
              </thead>
              <tbody>
                {variantRules.map(rule => (
                  <tr key={rule.id}>
                    <td className="font-bold text-slate-900">{rule.product}</td>
                    <td>{rule.attribute}</td>
                    <td className="text-sm text-slate-600">{rule.values.join(', ')}</td>
                    <td className="text-sm text-slate-600">
                      {rule.price_modifier.map((mod, idx) => (
                        <div key={idx} className="text-xs">
                          {rule.values[idx]}: {mod > 0 ? '+' : ''}{mod} RON
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pricing Tab */}
      {activeTab === 'pricing' && (
        <div className="space-y-4">
          {pricingCalculations.map((calc, idx) => (
            <div key={idx} className="card">
              <h3 className="font-bold text-slate-900 mb-4">{calc.configurator}</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Pret de Baza</span>
                  <span className="font-bold">{calc.base_price.toLocaleString()} RON</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Modificari</span>
                  <span className="font-bold text-blue-600">+{calc.total_modifiers.toLocaleString()} RON</span>
                </div>
                <div className="border-t pt-2 flex justify-between">
                  <span className="font-bold text-slate-900">Pret Final</span>
                  <span className="text-2xl font-bold text-green-600">{calc.final_price.toLocaleString()} RON</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { ConfiguratorsPage };
export default ConfiguratorsPage;
