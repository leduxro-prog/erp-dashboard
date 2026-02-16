import React from 'react';
import classNames from 'classnames';

interface BadgeProps {
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

const statusMap = {
  success: 'bg-green-100 text-green-800 border border-green-200',
  warning: 'bg-orange-100 text-orange-800 border border-orange-200',
  error: 'bg-red-100 text-red-800 border border-red-200',
  info: 'bg-blue-100 text-blue-800 border border-blue-200',
  neutral: 'bg-gray-100 text-gray-800 border border-gray-200',
};

export const Badge: React.FC<BadgeProps> = ({
  status = 'neutral',
  children,
  className,
  icon,
}) => {
  return (
    <span
      className={classNames(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium',
        statusMap[status],
        className
      )}
    >
      {icon && <span>{icon}</span>}
      {children}
    </span>
  );
};

export default Badge;
