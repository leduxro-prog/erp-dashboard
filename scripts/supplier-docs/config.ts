import path from 'node:path';

import { RunConfig, SupplierCode } from './types';

const SUPPLIER_CODES: SupplierCode[] = ['azzardo', 'aca'];

export interface BuildConfigInput {
  suppliers: string;
  mode?: RunConfig['mode'];
  storageRootDir?: string;
  translationMode?: RunConfig['translationMode'];
}

export function buildConfig(input: BuildConfigInput): RunConfig {
  return {
    suppliers: parseSuppliers(input.suppliers),
    mode: input.mode ?? 'live',
    storageRootDir: input.storageRootDir ?? path.join('uploads', 'supplier-docs'),
    translationMode: input.translationMode ?? 'auto',
  };
}

function parseSuppliers(rawSuppliers: string): SupplierCode[] {
  const unique = new Set<SupplierCode>();

  for (const item of rawSuppliers.split(',')) {
    const normalized = item.trim().toLowerCase();
    if (isSupplierCode(normalized)) {
      unique.add(normalized);
    }
  }

  if (unique.size === 0) {
    return [...SUPPLIER_CODES];
  }

  return [...unique];
}

function isSupplierCode(value: string): value is SupplierCode {
  return SUPPLIER_CODES.includes(value as SupplierCode);
}
