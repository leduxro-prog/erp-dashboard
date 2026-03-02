import path from 'node:path';

export interface DocPaths {
  originalPath: string;
  translatedPath: string;
}

export function buildDocPaths(
  storageRootDir: string,
  supplier: string,
  supplierSku: string,
  fileName: string,
): DocPaths {
  const safeSupplier = sanitizePathSegment(supplier);
  const safeSupplierSku = sanitizePathSegment(supplierSku);
  const safeFileName = sanitizeFileName(fileName);
  const translatedFileName = buildTranslatedFileName(safeFileName);

  return {
    originalPath: path.join(storageRootDir, safeSupplier, safeSupplierSku, 'original', safeFileName),
    translatedPath: path.join(
      storageRootDir,
      safeSupplier,
      safeSupplierSku,
      'ro-auto',
      translatedFileName,
    ),
  };
}

export function sanitizePathSegment(segment: string): string {
  const normalized = segment
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');

  return normalized.length > 0 ? normalized : 'unknown';
}

export function sanitizeFileName(fileName: string): string {
  const baseName = path.basename(fileName.trim());
  const parsed = path.parse(baseName);

  const safeName = sanitizePathSegment(parsed.name);
  const safeExt = parsed.ext
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, '')
    .replace(/\.+/g, '.');

  return `${safeName}${safeExt}`;
}

export function buildTranslatedFileName(fileName: string): string {
  const parsed = path.parse(fileName);

  if (!parsed.ext) {
    return `${parsed.name}-ro-auto`;
  }

  return `${parsed.name}-ro-auto${parsed.ext}`;
}
