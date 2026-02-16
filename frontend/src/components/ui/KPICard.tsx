import React, { useMemo } from 'react';
import classNames from 'classnames';

interface KPICardProps {
  icon: React.ReactNode;
  label?: string;
  title?: string;
  value: string | number;
  change?:
    | number
    | {
        value: number;
        isPositive?: boolean;
      };
  showTrend?: boolean;
  sparklineData?: number[] | Array<{ value: number }>;
  color?: 'default' | 'success' | 'warning' | 'danger';
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
  title,
  value,
  change = 0,
  showTrend = true,
  sparklineData,
  color = 'default',
  onClick,
}) => {
  const changeValue = typeof change === 'number' ? change : change.value;
  const isPositive =
    typeof change === 'number' ? change >= 0 : (change.isPositive ?? change.value >= 0);
  const displayLabel = label ?? title ?? '';
  const normalizedSparklineData = useMemo(() => {
    if (!sparklineData) {
      return undefined;
    }

    if (sparklineData.length === 0) {
      return [];
    }

    if (typeof sparklineData[0] === 'number') {
      return sparklineData as number[];
    }

    return (sparklineData as Array<{ value: number }>).map((item) => item.value);
  }, [sparklineData]);

  const sparklinePoints = useMemo(
    () => (normalizedSparklineData ? calculateSparkline(normalizedSparklineData) : ''),
    [normalizedSparklineData],
  );

  const iconColorClass =
    color === 'success'
      ? 'text-green-600'
      : color === 'warning'
        ? 'text-yellow-600'
        : color === 'danger'
          ? 'text-red-600'
          : 'text-blue-600';

  return (
    <div
      className={classNames(
        'rounded-xl border border-gray-200 bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md p-6 transition-all',
        onClick && 'cursor-pointer hover:bg-white/90',
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`text-3xl ${iconColorClass}`}>{icon}</div>
        {showTrend && changeValue !== 0 && (
          <div
            className={classNames(
              'flex items-center gap-1 text-sm font-semibold px-2 py-1 rounded',
              isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
            )}
          >
            {isPositive ? '↑' : '↓'} {Math.abs(changeValue)}%
          </div>
        )}
      </div>

      <p className="text-sm text-gray-600 mb-1">{displayLabel}</p>
      <p className="text-3xl font-bold text-gray-900 mb-4">{value}</p>

      {normalizedSparklineData && sparklinePoints && (
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
