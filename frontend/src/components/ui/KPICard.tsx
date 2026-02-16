import React, { useMemo } from 'react';
import classNames from 'classnames';

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: number;
  showTrend?: boolean;
  sparklineData?: number[];
  onClick?: () => void;
}

const calculateSparkline = (data: number[]) => {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * 100;
      const y = 100 - ((val - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return points;
};

export const KPICard: React.FC<KPICardProps> = ({
  icon,
  label,
  value,
  change = 0,
  showTrend = true,
  sparklineData,
  onClick,
}) => {
  const isPositive = change >= 0;
  const sparklinePoints = useMemo(
    () => (sparklineData ? calculateSparkline(sparklineData) : ''),
    [sparklineData]
  );

  return (
    <div
      className={classNames(
        'rounded-xl border border-gray-200 bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md p-6 transition-all',
        onClick && 'cursor-pointer hover:bg-white/90'
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="text-3xl text-blue-600">{icon}</div>
        {showTrend && change !== 0 && (
          <div
            className={classNames(
              'flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded',
              isPositive
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            )}
          >
            {isPositive ? '↑' : '↓'} {Math.abs(change)}%
          </div>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900 mb-4">{value}</p>

      {sparklineData && sparklinePoints && (
        <svg viewBox="0 0 100 40" className="w-full h-10">
          <polyline
            points={sparklinePoints}
            fill="none"
            stroke={isPositive ? '#10b981' : '#ef4444'}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            points={sparklinePoints}
            fill={isPositive ? '#d1fae5' : '#fee2e2'}
            fillOpacity="0.3"
            stroke="none"
          />
        </svg>
      )}
    </div>
  );
};

export default KPICard;
