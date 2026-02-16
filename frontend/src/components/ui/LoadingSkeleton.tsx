import clsx from 'clsx';

interface LoadingSkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'default' | 'circle' | 'text' | 'card';
}

export function LoadingSkeleton({
  width = 'w-full',
  height = 'h-4',
  className,
  variant = 'default',
}: LoadingSkeletonProps) {
  return (
    <div
      className={clsx(
        'bg-neutral-200 dark:bg-neutral-700 animate-pulse',
        {
          'rounded-macos': variant === 'default' || variant === 'text',
          'rounded-full': variant === 'circle',
          'rounded-macos-lg': variant === 'card',
        },
        width,
        height,
        className
      )}
    />
  );
}

interface SkeletonCardProps {
  lines?: number;
}

export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  return (
    <div className="card p-5 space-y-3">
      <LoadingSkeleton width="w-1/3" height="h-4" variant="text" />
      {Array.from({ length: lines }).map((_, i) => (
        <LoadingSkeleton
          key={i}
          width={i === lines - 1 ? 'w-2/3' : 'w-full'}
          height="h-3"
          variant="text"
        />
      ))}
    </div>
  );
}

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

export function SkeletonTable({ rows = 5, columns = 4 }: SkeletonTableProps) {
  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <LoadingSkeleton width="w-20" height="h-3" variant="text" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx}>
                  <LoadingSkeleton
                    width={colIdx === 0 ? 'w-24' : 'w-16'}
                    height="h-3"
                    variant="text"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
