import React from 'react';
import classNames from 'classnames';

interface SkeletonProps {
  variant?: 'text' | 'card' | 'table' | 'avatar';
  count?: number;
  width?: string;
  height?: string;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  count = 1,
  width = '100%',
  height = '1rem',
  className,
}) => {
  const baseClass = 'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse rounded';

  const variants = {
    text: <div className={classNames(baseClass, className)} style={{ width, height }} />,
    card: (
      <div className={classNames('space-y-3 p-4 rounded-lg', className)}>
        <div className={classNames(baseClass, 'h-8')} />
        <div className={classNames(baseClass, 'h-6')} />
        <div className={classNames(baseClass, 'h-6')} />
      </div>
    ),
    table: (
      <div className={classNames('space-y-2', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className={classNames(baseClass, 'h-10')} />
        ))}
      </div>
    ),
    avatar: <div className={classNames(baseClass, 'rounded-full w-10 h-10')} />,
  };

  if (count > 1 && variant === 'text') {
    return (
      <div className="space-y-2">
        {[...Array(count)].map((_, i) => (
          <div key={i} className={classNames(baseClass, className)} style={{ width, height }} />
        ))}
      </div>
    );
  }

  return <>{variants[variant]}</>;
};

export default Skeleton;
