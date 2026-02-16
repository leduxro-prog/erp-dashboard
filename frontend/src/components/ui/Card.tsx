import React from 'react';
import classNames from 'classnames';

interface CardProps {
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddingMap = {
  none: '',
  sm: 'p-3',
  md: 'p-6',
  lg: 'p-8',
};

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  icon,
  children,
  className,
  padding = 'md',
  onClick,
}) => {
  return (
    <div
      className={classNames(
        'rounded-xl border border-gray-200 bg-white/80 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow duration-200',
        paddingMap[padding],
        onClick && 'cursor-pointer hover:bg-white/90',
        className
      )}
      onClick={onClick}
    >
      {(title || icon) && (
        <div className="flex items-center gap-3 mb-4">
          {icon && <div className="text-lg text-blue-600">{icon}</div>}
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          </div>
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};

export default Card;
