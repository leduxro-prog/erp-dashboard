import React from 'react';
import classNames from 'classnames';

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'blue' | 'green' | 'red' | 'orange';
}

const colorMap = {
  blue: 'bg-blue-600',
  green: 'bg-green-600',
  red: 'bg-red-600',
  orange: 'bg-orange-600',
};

const sizeMap = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  showLabel = true,
  size = 'md',
  color = 'blue',
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div>
      <div
        className={classNames(
          'w-full rounded-full bg-gray-200 overflow-hidden',
          sizeMap[size]
        )}
      >
        <div
          className={classNames(
            'h-full transition-all duration-300 rounded-full',
            colorMap[color]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-sm text-gray-600 mt-1">{Math.round(percentage)}%</p>
      )}
    </div>
  );
};

export default ProgressBar;
