import { useState, useMemo, memo } from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
}

// Memoized row component to prevent unnecessary re-renders
interface TableRowProps<T> {
  row: T & { id: string | number };
  columns: Column<T>[];
  selectable: boolean;
  isSelected: boolean;
  onRowClick?: (row: T) => void;
  onToggleSelect: (id: string | number, checked: boolean) => void;
}

const TableRow = memo(<T extends { id: string | number }>({
  row,
  columns,
  selectable,
  isSelected,
  onRowClick,
  onToggleSelect,
}: TableRowProps<T>) => {
  return (
    <tr
      onClick={() => onRowClick?.(row)}
      className={clsx(
        'border-b border-gray-700 hover:bg-gray-700/30 transition-colors',
        isSelected && 'bg-blue-600/10',
        onRowClick && 'cursor-pointer'
      )}
    >
      {selectable && (
        <td className="px-6 py-4">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              onToggleSelect(row.id, e.target.checked);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-4 h-4 rounded cursor-pointer"
          />
        </td>
      )}
      {columns.map((col) => (
        <td key={col.key} className="px-6 py-4 text-gray-200">
          {col.render ? col.render((row as any)[col.key], row) : (row as any)[col.key]}
        </td>
      ))}
    </tr>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if row data or selection changed
  return (
    prevProps.row.id === nextProps.row.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.columns === nextProps.columns
  );
}) as <T extends { id: string | number }>(props: TableRowProps<T>) => JSX.Element;

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  isLoading = false,
  onRowClick,
  selectable = false,
}: DataTableProps<T>) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());

  const handleSort = (key: string) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  // Memoize sorted data to prevent re-sorting on every render
  const displayData = useMemo(() => {
    const sorted = [...data];
    if (sortBy) {
      sorted.sort((a, b) => {
        const aVal = (a as any)[sortBy];
        const bVal = (b as any)[sortBy];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return sorted;
  }, [data, sortBy, sortDir]);

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      {/* Bulk actions toolbar */}
      {selectedRows.size > 0 && (
        <div className="px-4 py-3 bg-blue-600/10 border-b border-gray-700 flex items-center justify-between">
          <p className="text-sm font-medium text-blue-400">
            {selectedRows.size} selected
          </p>
          <button
            onClick={() => setSelectedRows(new Set())}
            className="text-sm text-blue-400 hover:underline"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-200">
          <thead className="text-xs text-gray-300 uppercase bg-gray-700/50 border-b border-gray-600">
            <tr>
              {selectable && (
                <th className="w-10 px-6 py-3">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === displayData.length && displayData.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(new Set(displayData.map((r) => r.id)));
                      } else {
                        setSelectedRows(new Set());
                      }
                    }}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  className={`px-6 py-3 ${col.sortable ? 'cursor-pointer select-none group hover:bg-gray-600/50' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <span>{col.label}</span>
                    {col.sortable && (
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                        {sortBy === col.key ? (
                          sortDir === 'asc' ? (
                            <ChevronUp size={14} />
                          ) : (
                            <ChevronDown size={14} />
                          )
                        ) : (
                          <ChevronsUpDown size={14} className="opacity-50" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-gray-700">
                  {selectable && <td className="px-6 py-4"></td>}
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      <div className="h-4 bg-gray-600 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : displayData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="text-center py-8 text-gray-400">
                  <p>No data</p>
                </td>
              </tr>
            ) : (
              displayData.map((row) => (
                <TableRow
                  key={row.id}
                  row={row}
                  columns={columns}
                  selectable={selectable}
                  isSelected={selectedRows.has(row.id)}
                  onRowClick={onRowClick}
                  onToggleSelect={(id, checked) => {
                    const newSet = new Set(selectedRows);
                    if (checked) {
                      newSet.add(id);
                    } else {
                      newSet.delete(id);
                    }
                    setSelectedRows(newSet);
                  }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-700 bg-gray-800/30 text-xs text-gray-400">
        {displayData.length} results
      </div>
    </div>
  );
}
