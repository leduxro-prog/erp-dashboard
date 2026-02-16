import React from 'react';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'compact';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  action,
  variant = 'default',
}) => {
  const resolvedActionLabel = action?.label ?? actionLabel;
  const resolvedActionHandler = action?.onClick ?? onAction;

  return (
    <div
      className={`flex flex-col items-center justify-center px-4 ${
        variant === 'compact' ? 'py-8' : 'py-12'
      }`}
    >
      <div className={`${variant === 'compact' ? 'text-5xl' : 'text-6xl'} mb-4 opacity-50`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-center mb-6 max-w-sm">{description}</p>
      {resolvedActionLabel && resolvedActionHandler && (
        <button
          onClick={resolvedActionHandler}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {resolvedActionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
