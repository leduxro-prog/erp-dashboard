import React, { useState } from 'react';
import classNames from 'classnames';

export interface Column<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  selectable?: boolean;
  onSelectionChange?: (selected: (string | number)[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    onPageChange: (page: number) => void;
  };
}

export const Table = React.forwardRef<HTMLDivElement, TableProps<any>>(
  (
    {
      columns,
      data,
      keyExtractor,
      selectable,
      onSelectionChange,
      loading,
      emptyMessage = 'No data available',
      onRowClick,
      pagination,
    },
    ref
  ) => {
    const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleSelectAll = () => {
      if (selectedRows.size === data.length) {
        setSelectedRows(new Set());
        onSelectionChange?.([]);
      } else {
        const allKeys = new Set(data.map((row, idx) => keyExtractor(row, idx)));
        setSelectedRows(allKeys);
        onSelectionChange?.([...allKeys]);
      }
    };

    const handleSelectRow = (key: string | number) => {
      const newSelected = new Set(selectedRows);
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }
      setSelectedRows(newSelected);
      onSelectionChange?.([...newSelected]);
    };

    const handleSort = (key: string) => {
      if (sortKey === key) {
        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    };

    if (loading) {
      return (
        <div ref={ref} className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      );
    }

    if (data.length === 0) {
      return (
        <div
          ref={ref}
          className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg"
        >
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div ref={ref} className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === data.length && data.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className={classNames(
                    'px-4 py-3 text-left text-sm font-semibold text-gray-700',
                    col.sortable && 'cursor-pointer hover:bg-gray-100'
                  )}
                  onClick={() => col.sortable && handleSort(String(col.key))}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-2">
                    {col.label}
                    {col.sortable && sortKey === String(col.key) && (
                      <span>{sortDir === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const key = keyExtractor(row, idx);
              return (
                <tr
                  key={key}
                  className={classNames(
                    'border-b border-gray-200 hover:bg-blue-50 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(key)}
                        onChange={() => handleSelectRow(key)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-4 py-3 text-sm text-gray-900"
                      style={{ width: col.width }}
                    >
                      {col.render
                        ? col.render((row as any)[col.key], row)
                        : String((row as any)[col.key])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>

        {pagination && (
          <div className="flex items-center justify-between px-4 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= Math.ceil(pagination.total / pagination.limit)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }
);

Table.displayName = 'Table';

export default Table;
