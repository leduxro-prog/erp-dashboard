import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, ShoppingCart, RotateCcw } from 'lucide-react';

const Configurators = () => {
  const [step, setStep] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState({
    ledType: null,
    color: null,
    brightness: null,
    length: null,
    extras: [],
  });
  const [preview3D, setPreview3D] = useState('💡');

  const steps = [
    { num: 1, name: 'Tip LED', icon: '⚡' },
    { num: 2, name: 'Culoare', icon: '🎨' },
    { num: 3, name: 'Luminozitate', icon: '☀️' },
    { num: 4, name: 'Lungime', icon: '📏' },
    { num: 5, name: 'Accesorii', icon: '🎁' },
  ];

  const ledTypes = [
    { id: 'rgb', name: 'LED RGB Color', price: 12.50, description: '16M colors' },
    { id: 'ww', name: 'LED Alb Cald', price: 8.75, description: '3000K' },
    { id: 'cw', name: 'LED Alb Rece', price: 8.50, description: '6500K' },
    { id: 'uv', name: 'LED UV', price: 15.00, description: 'Ultraviolet' },
  ];

  const colors = [
    { id: 'red', name: 'Rosu', hex: '#EF4444' },
    { id: 'blue', name: 'Albastru', hex: '#3B82F6' },
    { id: 'green', name: 'Verde', hex: '#10B981' },
    { id: 'yellow', name: 'Galben', hex: '#FBBF24' },
  ];

  const brightness = [
    { id: 'low', name: 'Scazuta', level: '30%' },
    { id: 'medium', name: 'Medie', level: '60%' },
    { id: 'high', name: 'Inalta', level: '100%' },
  ];

  const lengths = [
    { id: '1m', name: '1 Metru', price: 12.50 },
    { id: '2m', name: '2 Metri', price: 22.50 },
    { id: '5m', name: '5 Metri', price: 50.00 },
    { id: '10m', name: '10 Metri', price: 95.00 },
  ];

  const extras = [
    { id: 'remote', name: 'Telecomanda IR', price: 25.00, selected: false },
    { id: 'timer', name: 'Timer inteligent', price: 35.00, selected: false },
    { id: 'controller', name: 'Controller DMX', price: 85.00, selected: false },
    { id: 'power', name: 'Alimentator 12V', price: 45.00, selected: false },
  ];

  const calculateTotal = () => {
    let total = 0;
    if (selectedOptions.ledType) {
      const led = ledTypes.find(l => l.id === selectedOptions.ledType);
      total += led.price;
    }
    if (selectedOptions.length) {
      const length = lengths.find(l => l.id === selectedOptions.length);
      total += length.price;
    }
    selectedOptions.extras.forEach(extraId => {
      const extra = extras.find(e => e.id === extraId);
      total += extra.price;
    });
    return total.toFixed(2);
  };

  const handleExtrasChange = (extraId) => {
    setSelectedOptions({
      ...selectedOptions,
      extras: selectedOptions.extras.includes(extraId)
        ? selectedOptions.extras.filter(id => id !== extraId)
        : [...selectedOptions.extras, extraId]
    });
  };

  const handleReset = () => {
    setStep(1);
    setSelectedOptions({
      ledType: null,
      color: null,
      brightness: null,
      length: null,
      extras: [],
    });
  };

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Configurator LED</h1>
          <p className="text-gray-500">Personalizati-va solutia LED perfecta</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Configurator Steps */}
          <div className="lg:col-span-2">
            {/* Progress */}
            <Card className="bg-white border-0 shadow-sm mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-medium text-gray-600">Pasul {step} din 5</p>
                  <p className="text-sm font-medium text-blue-600">{(step / 5 * 100).toFixed(0)}%</p>
                </div>
                <Progress value={(step / 5 * 100)} className="h-2" />
              </CardContent>
            </Card>

            {/* Steps Navigation */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {steps.map(s => (
                <button
                  key={s.num}
                  onClick={() => setStep(s.num)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
                    step === s.num
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {s.icon} {s.name}
                </button>
              ))}
            </div>

            {/* Step Content */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-2xl font-bold text-gray-900">{steps[step - 1].name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Step 1: LED Type */}
                {step === 1 && (
                  <div className="grid grid-cols-2 gap-4">
                    {ledTypes.map(led => (
                      <button
                        key={led.id}
                        onClick={() => setSelectedOptions({ ...selectedOptions, ledType: led.id })}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedOptions.ledType === led.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">{led.name}</p>
                        <p className="text-sm text-gray-600">{led.description}</p>
                        <p className="text-lg font-bold text-blue-600 mt-2">{led.price.toFixed(2)} RON</p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 2: Color */}
                {step === 2 && selectedOptions.ledType && (
                  <div className="grid grid-cols-2 gap-4">
                    {colors.map(color => (
                      <button
                        key={color.id}
                        onClick={() => setSelectedOptions({ ...selectedOptions, color: color.id, brightness: null })}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          selectedOptions.color === color.id
                            ? 'border-blue-600'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-lg border-2 border-gray-300"
                            style={{ backgroundColor: color.hex }}
                          />
                          <p className="font-semibold text-gray-900">{color.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 3: Brightness */}
                {step === 3 && selectedOptions.color && (
                  <div className="space-y-3">
                    {brightness.map(b => (
                      <button
                        key={b.id}
                        onClick={() => setSelectedOptions({ ...selectedOptions, brightness: b.id })}
                        className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                          selectedOptions.brightness === b.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-gray-900">{b.name}</p>
                          <p className="text-gray-600">{b.level}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 4: Length */}
                {step === 4 && selectedOptions.brightness && (
                  <div className="grid grid-cols-2 gap-4">
                    {lengths.map(length => (
                      <button
                        key={length.id}
                        onClick={() => setSelectedOptions({ ...selectedOptions, length: length.id })}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedOptions.length === length.id
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">{length.name}</p>
                        <p className="text-lg font-bold text-blue-600 mt-2">+{length.price.toFixed(2)} RON</p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Step 5: Extras */}
                {step === 5 && selectedOptions.length && (
                  <div className="space-y-3">
                    {extras.map(extra => (
                      <label key={extra.id} className="p-4 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all cursor-pointer flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedOptions.extras.includes(extra.id)}
                          onChange={() => handleExtrasChange(extra.id)}
                          className="w-4 h-4"
                        />
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900">{extra.name}</p>
                          <p className="text-sm text-gray-600">+{extra.price.toFixed(2)} RON</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Navigation Buttons */}
            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setStep(Math.max(1, step - 1))}
                disabled={step === 1}
                variant="outline"
                className="flex-1"
              >
                Inapoi
              </Button>
              <Button
                onClick={() => setStep(Math.min(5, step + 1))}
                disabled={step === 5 || (step === 1 && !selectedOptions.ledType) || (step === 2 && !selectedOptions.color) || (step === 3 && !selectedOptions.brightness) || (step === 4 && !selectedOptions.length)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                Inainte <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Right: Preview & Summary */}
          <div className="space-y-6">
            {/* 3D Preview */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Previzualizare 3D</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg flex items-center justify-center mb-4">
                  <div className="text-6xl">{preview3D}</div>
                </div>
                <p className="text-sm text-gray-600 text-center">Rotire si zoom cu mouse</p>
              </CardContent>
            </Card>

            {/* Order Summary */}
            <Card className="bg-white border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">Rezumat comanda</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedOptions.ledType && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Tip LED</p>
                    <p className="font-semibold text-gray-900">{ledTypes.find(l => l.id === selectedOptions.ledType)?.name}</p>
                  </div>
                )}

                {selectedOptions.color && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Culoare</p>
                    <p className="font-semibold text-gray-900">{colors.find(c => c.id === selectedOptions.color)?.name}</p>
                  </div>
                )}

                {selectedOptions.brightness && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Luminozitate</p>
                    <p className="font-semibold text-gray-900">{brightness.find(b => b.id === selectedOptions.brightness)?.name}</p>
                  </div>
                )}

                {selectedOptions.length && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Lungime</p>
                    <p className="font-semibold text-gray-900">{lengths.find(l => l.id === selectedOptions.length)?.name}</p>
                  </div>
                )}

                {selectedOptions.extras.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-2">Accesorii</p>
                    <ul className="space-y-1">
                      {selectedOptions.extras.map(extraId => (
                        <li key={extraId} className="text-sm font-semibold text-gray-900">
                          • {extras.find(e => e.id === extraId)?.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-3">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-lg font-bold text-gray-900">Total:</p>
                    <p className="text-2xl font-bold text-blue-600">{calculateTotal()} RON</p>
                  </div>

                  <Button className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 mb-2">
                    <ShoppingCart className="w-4 h-4" />
                    Adauga in cos
                  </Button>

                  <Button
                    onClick={handleReset}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reseteaza
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Configurators;
