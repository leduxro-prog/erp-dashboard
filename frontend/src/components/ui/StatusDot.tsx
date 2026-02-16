import React from 'react';
import classNames from 'classnames';

interface StatusDotProps {
  status: 'online' | 'offline' | 'busy' | 'away';
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusMap = {
  online: {
    bg: 'bg-green-500',
    pulse: 'animate-pulse',
  },
  offline: {
    bg: 'bg-gray-400',
    pulse: '',
  },
  busy: {
    bg: 'bg-red-500',
    pulse: 'animate-pulse',
  },
  away: {
    bg: 'bg-yellow-500',
    pulse: 'animate-pulse',
  },
};

const sizeMap = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

const statusLabelMap = {
  online: 'Online',
  offline: 'Offline',
  busy: 'Busy',
  away: 'Away',
};

export const StatusDot: React.FC<StatusDotProps> = ({
  status,
  label,
  size = 'md',
}) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={classNames(
          'rounded-full',
          sizeMap[size],
          statusMap[status].bg,
          statusMap[status].pulse
        )}
      />
      <span className="text-sm text-gray-600">
        {label || statusLabelMap[status]}
      </span>
    </div>
  );
};

export default StatusDot;
