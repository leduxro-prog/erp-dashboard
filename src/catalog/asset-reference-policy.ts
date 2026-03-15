export type AssetClass =
  | 'primary-image'
  | 'gallery-image'
  | 'supplier-asset'
  | 'datasheet'
  | 'certificate'
  | 'installation-document'
  | 'warranty-document'
  | 'compliance-document';

export type AssetAccess = 'public' | 'signed';

export type AssetOrigin = 'erp' | 'supplier' | 'derived';

export type MimeClassification = 'image' | 'pdf' | 'other';

export interface PublishedAssetRef {
  assetClass: AssetClass;
  url: string;
  checksum: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  access: AssetAccess;
  origin: AssetOrigin;
  updatedAt: string;
}

// Asset classes that require signed (non-public) CDN access.
// supplier-asset and compliance-document are restricted by default.
const RESTRICTED_ASSET_CLASSES = new Set<string>(['supplier-asset', 'compliance-document']);

export function classifyAssetByMime(mimeType: string): MimeClassification {
  const mime = String(mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) {
    return 'image';
  }
  if (mime === 'application/pdf') {
    return 'pdf';
  }
  return 'other';
}

export function validateAssetRef(asset: unknown): boolean {
  if (!asset || typeof asset !== 'object') {
    throw new Error('Asset ref must be an object');
  }

  const record = asset as Record<string, unknown>;

  const required: (keyof PublishedAssetRef)[] = [
    'assetClass',
    'url',
    'checksum',
    'mimeType',
    'sizeBytes',
    'version',
    'access',
    'origin',
    'updatedAt',
  ];

  for (const key of required) {
    if (record[key] === undefined || record[key] === null || record[key] === '') {
      throw new Error(`Missing required asset field: ${key}`);
    }
  }

  if (!/^https?:\/\//.test(String(record['url']))) {
    throw new Error('Asset URL must be http/https');
  }

  if (!['public', 'signed'].includes(String(record['access']))) {
    throw new Error('Asset access must be public or signed');
  }

  if (!['erp', 'supplier', 'derived'].includes(String(record['origin']))) {
    throw new Error('Asset origin must be erp, supplier, or derived');
  }

  return true;
}

export function shouldUseSignedAccess(assetClass: string): boolean {
  const value = String(assetClass || '').toLowerCase();
  return RESTRICTED_ASSET_CLASSES.has(value);
}
