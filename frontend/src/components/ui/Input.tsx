import React from 'react';
import classNames from 'classnames';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'prefix' | 'suffix';
  variant?: 'default' | 'search';
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  iconPosition = 'prefix',
  variant = 'default',
  className,
  disabled,
  ...props
}) => {
  const isSearch = variant === 'search';
  const hasIcon = icon && (isSearch || iconPosition === 'prefix');
  const hasSuffixIcon = icon && iconPosition === 'suffix';

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      )}
      <div className="relative">
        {hasIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            {isSearch ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            ) : (
              icon
            )}
          </div>
        )}
        <input
          className={classNames(
            'w-full px-4 py-2 rounded-lg border-2 border-gray-200 bg-white transition-all duration-200',
            'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
            'placeholder:text-gray-400',
            hasIcon && 'pl-10',
            hasSuffixIcon && 'pr-10',
            disabled && 'bg-gray-100 text-gray-500 cursor-not-allowed',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            className
          )}
          disabled={disabled}
          {...props}
        />
        {hasSuffixIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            {icon}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
};

export default Input;
