import React, { useState } from 'react';
import { Barcode, ShoppingCart, CreditCard, DollarSign, RotateCcw, Trash2, Wifi, WifiOff, User } from 'lucide-react';

const POSPage: React.FC = () => {
  const [barcode, setBarcode] = useState('');
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [isOnline, setIsOnline] = useState(true);

  const addToCart = () => {
    if (barcode) {
      const products: any = {
        '8718245074558': { name: 'Laptop Pro 15"', price: 4500 },
        '8718245074559': { name: 'Monitor 27"', price: 2200 },
        '8718245074560': { name: 'Keyboard', price: 550 },
        '8718245074561': { name: 'Mouse', price: 280 },
      };

      const product = products[barcode];
      if (product) {
        const existing = cartItems.find(item => item.barcode === barcode);
        if (existing) {
          existing.qty += 1;
        } else {
          setCartItems([...cartItems, { barcode, ...product, qty: 1 }]);
        }
        setBarcode('');
      }
    }
  };

  const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const dailySalesData = [
    { hour: '08:00', sales: 850 },
    { hour: '12:00', sales: 2450 },
    { hour: '16:00', sales: 1620 },
    { hour: '20:00', sales: 4200 },
  ];

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen">
      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">POS Terminal</h1>
          <p className="text-sm text-slate-600">Operator: Ion Popescu</p>
        </div>
        <div className="flex items-center gap-4">
          {isOnline ? (
            <div className="flex items-center gap-2 badge-success">
              <Wifi size={16} />
              Online
            </div>
          ) : (
            <div className="flex items-center gap-2 badge-danger">
              <WifiOff size={16} />
              Offline Mode
            </div>
          )}
          <button className="btn-secondary flex items-center gap-2">
            <User size={18} />
            Schimba Operator
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* POS Terminal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Barcode Scanner */}
          <div className="card">
            <label className="block text-sm font-medium text-slate-700 mb-3">Scaneaza Codul de Bare</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Apasa pentru a scana..."
                className="input flex-1 text-lg font-mono"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addToCart()}
                autoFocus
              />
              <button onClick={addToCart} className="btn-primary">
                <Barcode size={20} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">Exemplu: 8718245074558</p>
          </div>

          {/* Cart Items */}
          <div className="card">
            <h3 className="section-title mb-4">Articole Cos</h3>
            {cartItems.length === 0 ? (
              <p className="text-slate-600 text-center py-8">Cosul este gol</p>
            ) : (
              <div className="space-y-2">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-600">{item.price} RON × {item.qty}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold">{(item.price * item.qty).toLocaleString()} RON</p>
                      <button onClick={() => setCartItems(cartItems.filter((_, i) => i !== idx))} className="text-red-600 hover:text-red-700">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="grid grid-cols-2 gap-3">
              <button className="btn-secondary flex items-center justify-center gap-2 h-12">
                <RotateCcw size={18} />
                Retur
              </button>
              <button className="btn-secondary flex items-center justify-center gap-2 h-12">
                Discount
              </button>
              <button className="btn-secondary col-span-2 h-12">Anulare Comanda</button>
            </div>
          </div>

          {/* Receipt Preview */}
          <div className="card">
            <h3 className="section-title mb-3">Previzualizare Bon Fiscal</h3>
            <div className="bg-white p-4 rounded font-mono text-sm border-2 border-dashed border-slate-300">
              <div className="text-center mb-3">
                <p className="font-bold">CYPHER POS</p>
                <p className="text-xs text-slate-600">Terminal: POS-001</p>
              </div>
              <div className="border-t border-b py-2 mb-2">
                {cartItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs mb-1">
                    <span>{item.qty}x {item.name.substring(0, 15)}</span>
                    <span>{(item.price * item.qty).toLocaleString()} RON</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold mb-2">
                <span>TOTAL:</span>
                <span>{cartTotal.toLocaleString()} RON</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment & Summary */}
        <div className="space-y-6">
          {/* Payment Methods */}
          <div className="card">
            <h3 className="section-title mb-4">Metoda Plata</h3>
            <div className="space-y-2">
              {[
                { id: 'cash', label: 'Numerar', icon: DollarSign },
                { id: 'card', label: 'Card Bancar', icon: CreditCard },
                { id: 'mixed', label: 'Mixt (Numerar + Card)', icon: ShoppingCart },
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`w-full p-3 rounded-lg flex items-center gap-2 font-medium transition ${
                    paymentMethod === method.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <method.icon size={18} />
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Amount */}
          <div className="card">
            <div className="mb-4">
              <p className="text-slate-600 text-sm mb-1">Suma de Platit</p>
              <p className="text-4xl font-bold text-slate-900">{cartTotal.toLocaleString()} RON</p>
            </div>

            {paymentMethod === 'mixed' && (
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Numerar</label>
                  <input type="number" placeholder="0" className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Card</label>
                  <input type="number" placeholder="0" className="input w-full" />
                </div>
              </div>
            )}

            <button className="btn-primary w-full h-14 text-lg font-bold">INCASARE</button>
          </div>

          {/* Daily Summary */}
          <div className="card">
            <h3 className="section-title mb-4">Raport Zilei</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-slate-600">Vanzari</span>
                <span className="font-bold">28,450 RON</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Comenzi</span>
                <span className="font-bold">42</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Ticket mediu</span>
                <span className="font-bold">677 RON</span>
              </div>
              <div className="border-t pt-3 flex justify-between">
                <span className="text-slate-600 font-medium">Numerar Asteptat</span>
                <span className="font-bold text-green-600">18,900 RON</span>
              </div>
            </div>
            <button className="btn-secondary w-full mt-4 text-sm">Inchidere Caz Zilei</button>
          </div>

          {/* Customer Lookup */}
          <div className="card">
            <h3 className="section-title mb-4">Client & Fidelizare</h3>
            <input type="text" placeholder="CIF/J sau numar telefon..." className="input w-full mb-3" />
            <button className="btn-secondary w-full">Cauta Client</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { POSPage };
export default POSPage;
