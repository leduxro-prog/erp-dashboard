import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, AlertTriangle, Info, TrendingUp, Clock, Package } from 'lucide-react';
import { b2bApi } from '../../services/b2b-api';

interface CreditData {
  creditLimit: number;
  usedCredit: number;
  availableCredit: number;
  pendingOrders: number;
  pendingOrdersValue: number;
  paymentTermsDays: number;
  tier: string;
  tierDiscount: number;
}

interface CreditWidgetProps {
  variant?: 'default' | 'compact' | 'header' | 'card';
  showPending?: boolean;
  showTooltip?: boolean;
  className?: string;
  onCreditLoad?: (data: CreditData) => void;
}

const formatCurrency = (value: number, currency: string = 'RON') => {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

export const CreditWidget: React.FC<CreditWidgetProps> = ({
  variant = 'default',
  showPending = true,
  showTooltip = true,
  className = '',
  onCreditLoad,
}) => {
  const [creditData, setCreditData] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const fetchCreditData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await b2bApi.getCredit();
      const data: CreditData = {
        creditLimit: parseFloat(String(response.credit_limit)) || 0,
        usedCredit: parseFloat(String(response.credit_used)) || 0,
        availableCredit: parseFloat(String(response.credit_available)) || 0,
        pendingOrders: response.pending_orders || 0,
        pendingOrdersValue: response.pending_orders_value || 0,
        paymentTermsDays: response.payment_terms_days || 30,
        tier: response.tier || 'STANDARD',
        tierDiscount: response.tier_discount_percentage || 0,
      };
      setCreditData(data);
      onCreditLoad?.(data);
    } catch (err) {
      console.error('Failed to fetch credit data:', err);
      setError('Nu s-au putut încărca datele de credit');
    } finally {
      setLoading(false);
    }
  }, [onCreditLoad]);

  useEffect(() => {
    fetchCreditData();
  }, [fetchCreditData]);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-24 bg-gray-200 rounded-xl"></div>
      </div>
    );
  }

  if (error || !creditData) {
    return null;
  }

  const usagePercent = creditData.creditLimit > 0 
    ? (creditData.usedCredit / creditData.creditLimit) * 100 
    : 0;

  const isWarning = usagePercent >= 80;
  const isCritical = usagePercent >= 95;
  const progressColor = isCritical 
    ? 'bg-red-500' 
    : isWarning 
    ? 'bg-amber-500' 
    : 'bg-gradient-to-r from-blue-500 to-cyan-400';

  const progressBarBg = isCritical 
    ? 'bg-red-100' 
    : isWarning 
    ? 'bg-amber-100' 
    : 'bg-gray-100';

  if (variant === 'header') {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors hover:bg-gray-100"
        >
          <CreditCard size={16} className={isWarning ? 'text-amber-500' : 'text-gray-500'} />
          <span className="text-sm font-medium text-gray-700">
            {formatCurrency(creditData.availableCredit)}
          </span>
          {isWarning && (
            <AlertTriangle size={14} className="text-amber-500" />
          )}
        </button>

        {showDetails && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-900">Credit B2B</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                isCritical ? 'bg-red-100 text-red-700' :
                isWarning ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {formatPercent(100 - usagePercent)} disponibil
              </span>
            </div>
            <div className={`w-full h-2 rounded-full ${progressBarBg} overflow-hidden mb-3`}>
              <div 
                className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Limită totală</span>
                <span className="font-medium text-gray-900">{formatCurrency(creditData.creditLimit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Credit utilizat</span>
                <span className="font-medium text-gray-900">{formatCurrency(creditData.usedCredit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Disponibil</span>
                <span className={`font-bold ${isWarning ? 'text-amber-600' : 'text-green-600'}`}>
                  {formatCurrency(creditData.availableCredit)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="flex items-center gap-2">
          <CreditCard size={16} className={isWarning ? 'text-amber-500' : 'text-blue-500'} />
          <span className="text-sm font-medium text-gray-700">
            {formatCurrency(creditData.availableCredit)} disponibil
          </span>
        </div>
        <div className="flex-1 max-w-[100px]">
          <div className={`w-full h-1.5 rounded-full ${progressBarBg} overflow-hidden`}>
            <div 
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
        </div>
        {isWarning && (
          <AlertTriangle size={14} className="text-amber-500" />
        )}
      </div>
    );
  }

  if (variant === 'card') {
    return (
      <div className={`bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-xl ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard size={20} className="text-blue-400" />
            <span className="font-semibold">Credit B2B</span>
          </div>
          {isWarning && (
            <span className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full">
              <AlertTriangle size={12} />
              Avertisment
            </span>
          )}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-slate-400">Disponibil</span>
            <span className="font-bold text-lg">{formatCurrency(creditData.availableCredit)}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                isCritical ? 'bg-red-500' :
                isWarning ? 'bg-amber-500' :
                'bg-gradient-to-r from-blue-500 to-cyan-400'
              }`}
              style={{ width: `${Math.min(usagePercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500 mt-1.5">
            <span>{formatPercent(usagePercent)} utilizat</span>
            <span>{formatPercent(100 - usagePercent)} rămas</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-700/50 rounded-lg p-2.5">
            <span className="text-slate-400 text-xs">Limită</span>
            <p className="font-semibold text-white">{formatCurrency(creditData.creditLimit)}</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-2.5">
            <span className="text-slate-400 text-xs">Utilizat</span>
            <p className="font-semibold text-white">{formatCurrency(creditData.usedCredit)}</p>
          </div>
        </div>

        {showPending && creditData.pendingOrders > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-slate-400">
              <Clock size={14} />
              <span>{creditData.pendingOrders} comenzi în așteptare</span>
            </div>
            <span className="font-medium text-white">{formatCurrency(creditData.pendingOrdersValue)}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isWarning ? 'bg-amber-100' : 'bg-blue-100'
            }`}>
              <CreditCard size={18} className={isWarning ? 'text-amber-600' : 'text-blue-600'} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Credit Disponibil</h3>
              <p className="text-xs text-gray-500">Net {creditData.paymentTermsDays} zile</p>
            </div>
          </div>
          {showTooltip && (
            <div className="relative group">
              <Info size={16} className="text-gray-400 cursor-help" />
              <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 text-white text-xs rounded-lg p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <p className="font-medium mb-1">Credit B2B</p>
                <p className="text-gray-300">
                  Limita de credit aprobată pentru achiziții. Plățile se efectuează în {creditData.paymentTermsDays} zile de la facturare.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
        {isWarning && (
          <div className={`mb-4 p-3 rounded-lg flex items-start gap-2 ${
            isCritical ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          }`}>
            <AlertTriangle size={16} className={`mt-0.5 flex-shrink-0 ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />
            <p className={`text-sm ${isCritical ? 'text-red-700' : 'text-amber-700'}`}>
              {isCritical 
                ? 'Creditul este aproape epuizat! Plătește facturile pentru a elibera credit.'
                : 'Utilizare ridicată a creditului. Monitorizează plățile.'}
            </p>
          </div>
        )}

        <div className="flex items-baseline gap-2 mb-3">
          <span className={`text-3xl font-bold ${isWarning ? 'text-amber-600' : 'text-gray-900'}`}>
            {formatCurrency(creditData.availableCredit)}
          </span>
          <span className="text-sm text-gray-500">
            din {formatCurrency(creditData.creditLimit)}
          </span>
        </div>

        <div className={`w-full h-3 rounded-full ${progressBarBg} overflow-hidden mb-2`}>
          <div 
            className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500 mb-4">
          <span>{formatPercent(usagePercent)} utilizat</span>
          <span>{formatPercent(100 - usagePercent)} disponibil</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <TrendingUp size={12} />
              <span>Credit utilizat</span>
            </div>
            <p className="font-bold text-gray-900">{formatCurrency(creditData.usedCredit)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
              <Package size={12} />
              <span>Comenzi active</span>
            </div>
            <p className="font-bold text-gray-900">{creditData.pendingOrders || 0}</p>
          </div>
        </div>

        {showPending && creditData.pendingOrders > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Clock size={14} />
                <span>Valoare comenzi în așteptare</span>
              </div>
              <span className="font-semibold text-gray-900">
                {formatCurrency(creditData.pendingOrdersValue)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const CreditWidgetMini: React.FC<{
  creditLimit: number;
  usedCredit: number;
  className?: string;
}> = ({ creditLimit, usedCredit, className = '' }) => {
  const availableCredit = creditLimit - usedCredit;
  const usagePercent = creditLimit > 0 ? (usedCredit / creditLimit) * 100 : 0;
  const isWarning = usagePercent >= 80;
  const isCritical = usagePercent >= 95;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <CreditCard size={14} className={isWarning ? 'text-amber-500' : 'text-blue-500'} />
      <div className="flex-1">
        <div className={`w-full h-1.5 rounded-full ${
          isCritical ? 'bg-red-100' : isWarning ? 'bg-amber-100' : 'bg-gray-100'
        } overflow-hidden`}>
          <div 
            className={`h-full rounded-full transition-all ${
              isCritical ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(usagePercent, 100)}%` }}
          />
        </div>
      </div>
      <span className={`text-sm font-medium ${isWarning ? 'text-amber-600' : 'text-gray-600'}`}>
        {formatCurrency(availableCredit)}
      </span>
    </div>
  );
};

export default CreditWidget;
