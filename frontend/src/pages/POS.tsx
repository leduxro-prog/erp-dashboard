import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus, Minus, Wifi, WifiOff, Settings, LogOut, Receipt, RotateCcw } from 'lucide-react';

interface CartItem {
  sku: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
  stock: number;
}

const POS = () => {
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('LED');
  const [barcode, setBarcode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isOnline] = useState(true);
  const [returnMode, setReturnMode] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);

  const products: CartItem[] = [
    { sku: 'LED-RGB-5050', name: 'LED RGB 5050 SMD', price: 12.50, category: 'LED', stock: 450, quantity: 0 },
    { sku: 'LED-ALB-3000K', name: 'LED Alb 3000K WW', price: 8.75, category: 'LED', stock: 320, quantity: 0 },
    { sku: 'CTRL-DMX512', name: 'Controller DMX 512', price: 85.00, category: 'Controlere', stock: 45, quantity: 0 },
    { sku: 'BAND-LED-12V', name: 'Banda LED RGB 12V', price: 25.00, category: 'Benzi LED', stock: 120, quantity: 0 },
    { sku: 'TRANSF-12V50W', name: 'Transformator 12V 50W', price: 45.00, category: 'Alimentare', stock: 85, quantity: 0 },
    { sku: 'CONN-XLR-M', name: 'Conector XLR M 3 Pini', price: 5.50, category: 'Conectori', stock: 200, quantity: 0 },
    { sku: 'FILT-LED-CW', name: 'Filtru LED Alb Rece', price: 3.20, category: 'Filtre', stock: 580, quantity: 0 },
    { sku: 'RELEU-DMR', name: 'Releu Dimmer DMX', price: 120.00, category: 'Controlere', stock: 22, quantity: 0 },
  ];

  const categories = ['LED', 'Benzi LED', 'Controlere', 'Conectori', 'Filtre', 'Alimentare'];

  const filteredProducts = products.filter(p => p.category === selectedCategory);

  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, []);

  const handleBarcodeInput = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && barcode.trim()) {
      const product = products.find(p => p.sku === barcode || (p as any).barcode === barcode);
      if (product) {
        addToCart(product);
      }
      setBarcode('');
      barcodeInputRef.current?.focus();
    }
  };

  const addToCart = (product: CartItem) => {
    const existingItem = cartItems.find(item => item.sku === product.sku);
    if (existingItem) {
      setCartItems(cartItems.map(item =>
        item.sku === product.sku ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setCartItems([...cartItems, { ...product, quantity: 1 }]);
    }
  };

  const updateQuantity = (sku: string, delta: number) => {
    setCartItems(cartItems.map(item => {
      if (item.sku === sku) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (sku: string) => {
    setCartItems(cartItems.filter(item => item.sku !== sku));
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = (subtotal * discount) / 100;
  const total = subtotal - discountAmount;

  const clearCart = () => {
    setCartItems([]);
    setDiscount(0);
    setPaymentMethod(null);
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">CYPHER POS</h1>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {isOnline ? (
                <>
                  <Wifi className="w-4 h-4 text-green-600" />
                  <span>Online</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-600" />
                  <span>Offline</span>
                </>
              )}
            </div>
            <div className="text-sm text-gray-600">Operator: Andrei Popescu</div>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Setari
            </Button>
            <Button variant="outline" size="sm">
              <LogOut className="w-4 h-4 mr-2" />
              Iesire
            </Button>
          </div>
        </div>

        <div className="flex-1 flex gap-6 p-6 overflow-hidden">
          {/* LEFT: Products Grid (60%) */}
          <div className="w-3/5 flex flex-col gap-4 overflow-hidden">
            {/* Barcode Input */}
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-4">
                <Input
                  ref={barcodeInputRef}
                  type="text"
                  placeholder="Scaneaza barcode..."
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  onKeyDown={handleBarcodeInput}
                  className="text-lg"
                  autoFocus
                />
              </CardContent>
            </Card>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="whitespace-nowrap"
                >
                  {cat}
                </Button>
              ))}
            </div>

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3">
              {filteredProducts.map(product => (
                <button
                  key={product.sku}
                  onClick={() => addToCart(product)}
                  className="p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left"
                >
                  <p className="font-semibold text-gray-900 text-sm line-clamp-2">{product.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-blue-600">{product.price.toFixed(2)} RON</span>
                    <Badge className="bg-green-100 text-green-800 text-xs">{product.stock}</Badge>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Cart & Payment (40%) */}
          <div className="w-2/5 flex flex-col gap-4 overflow-hidden">
            {/* Cart Items */}
            <Card className="bg-white border-0 shadow-sm flex-1 overflow-hidden flex flex-col">
              <CardHeader className="bg-gray-50 border-b border-gray-200 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">Cos cumparaturi</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReturnMode(!returnMode)}
                    className={returnMode ? 'text-red-600' : 'text-gray-600'}
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-0">
                {cartItems.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <p className="text-center">
                      <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      Cos gol
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {cartItems.map(item => (
                      <div key={item.sku} className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                            <p className="text-xs text-gray-500">{item.sku}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromCart(item.sku)}
                            className="w-6 h-6 p-0 text-red-600 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateQuantity(item.sku, -1)}
                              className="w-6 h-6 p-0"
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => updateQuantity(item.sku, 1)}
                              className="w-6 h-6 p-0"
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">
                              {(item.price * item.quantity).toFixed(2)} RON
                            </p>
                            <p className="text-xs text-gray-500">{item.price.toFixed(2)} x {item.quantity}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Discounts & Total */}
            <Card className="bg-white border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Discount</p>
                  <div className="flex gap-2">
                    {[0, 5, 10, 15].map(d => (
                      <Button
                        key={d}
                        variant={discount === d ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setDiscount(d)}
                      >
                        {d}%
                      </Button>
                    ))}
                    <Input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(parseInt(e.target.value) || 0)}
                      className="w-16 h-8"
                      min="0"
                      max="100"
                    />
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-semibold text-gray-900">{subtotal.toFixed(2)} RON</span>
                  </div>
                  {discountAmount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Discount ({discount}%)</span>
                      <span>-{discountAmount.toFixed(2)} RON</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                    <span>Total</span>
                    <span className="text-blue-600">{total.toFixed(2)} RON</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            {cartItems.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <Button
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setPaymentMethod('cash')}
                >
                  💵 Numerar
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setPaymentMethod('card')}
                >
                  💳 Card
                </Button>
                <Button
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                  onClick={() => setPaymentMethod('mixed')}
                >
                  📱 Mixt
                </Button>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <Button
                onClick={() => setShowReceipt(true)}
                disabled={cartItems.length === 0}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white"
              >
                <Receipt className="w-4 h-4 mr-2" />
                Previzualizare bon
              </Button>
              <Button
                onClick={clearCart}
                disabled={cartItems.length === 0}
                variant="outline"
                className="w-full"
              >
                Goleste cos
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POS;
