import React, { useState, useRef, useEffect } from 'react';
import classNames from 'classnames';

interface SelectOption {
  value: string | number;
  label: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value?: string | number | (string | number)[];
  onChange: (value: string | number | (string | number)[]) => void;
  placeholder?: string;
  multi?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  error?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  multi = false,
  searchable = false,
  disabled = false,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = searchable
    ? options.filter((opt) =>
        opt.label.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  const selectedOptions = Array.isArray(value)
    ? options.filter((opt) => (value as (string | number)[]).includes(opt.value))
    : value !== undefined
    ? options.filter((opt) => opt.value === value)
    : [];

  const displayValue =
    selectedOptions.length === 0
      ? placeholder
      : selectedOptions.map((opt) => opt.label).join(', ');

  const handleSelect = (optValue: string | number) => {
    if (multi && Array.isArray(value)) {
      const newValue = (value as (string | number)[]).includes(optValue)
        ? (value as (string | number)[]).filter((v) => v !== optValue)
        : [...(value as (string | number)[]), optValue];
      onChange(newValue);
    } else {
      onChange(optValue);
      setIsOpen(false);
    }
    setSearchTerm('');
  };

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={classNames(
            'w-full px-4 py-2 rounded-lg border-2 border-gray-200 bg-white text-left transition-all duration-200',
            'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
            'flex items-center justify-between',
            disabled && 'bg-gray-100 text-gray-500 cursor-not-allowed',
            error && 'border-red-500'
          )}
        >
          <span className={displayValue === placeholder ? 'text-gray-400' : ''}>
            {displayValue}
          </span>
          <svg
            className={classNames('w-5 h-5 text-gray-500 transition-transform', {
              'rotate-180': isOpen,
            })}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
            {searchable && (
              <div className="p-2 border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
            <div className="max-h-60 overflow-y-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-4 py-2 text-gray-500">No options</div>
              ) : (
                filteredOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={classNames(
                      'w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors',
                      selectedOptions.some((s) => s.value === opt.value) &&
                        'bg-blue-50 font-medium text-blue-600'
                    )}
                  >
                    {multi && (
                      <input
                        type="checkbox"
                        checked={selectedOptions.some((s) => s.value === opt.value)}
                        onChange={() => {}}
                        className="mr-2"
                      />
                    )}
                    {opt.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  );
};

export default Select;
