import { useState, useCallback } from 'react';
import { PaginationParams } from '../types/common';

interface UsePaginationOptions {
  initialPage?: number;
  initialLimit?: number;
  initialSort?: string;
}

export function usePagination(options: UsePaginationOptions = {}) {
  const [params, setParams] = useState<PaginationParams>({
    page: options.initialPage || 1,
    limit: options.initialLimit || 10,
    sortBy: options.initialSort || undefined,
  });

  const goToPage = useCallback((page: number) => {
    setParams((prev) => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setParams((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  const setSort = useCallback((sortBy: string, sortDir: 'asc' | 'desc' = 'asc') => {
    setParams((prev) => ({
      ...prev,
      sortBy,
      sortDir,
      page: 1,
    }));
  }, []);

  const reset = useCallback(() => {
    setParams({
      page: options.initialPage || 1,
      limit: options.initialLimit || 10,
      sortBy: options.initialSort || undefined,
    });
  }, [options]);

  return {
    ...params,
    goToPage,
    setLimit,
    setSort,
    reset,
  };
}

export default usePagination;
