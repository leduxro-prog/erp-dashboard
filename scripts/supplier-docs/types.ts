export type SupplierCode = 'azzardo' | 'aca';

export type DocType =
  | 'datasheet'
  | 'installation_guide'
  | 'technical_drawing'
  | 'product_image'
  | 'model_3d'
  | 'certificate'
  | 'photometric_data';

export interface DiscoveredDoc {
  supplier: SupplierCode;
  supplierSku: string;
  docType: DocType;
  sourceUrl: string;
  fileName: string;
}

export interface StoredDoc {
  supplier: SupplierCode;
  supplierSku: string;
  docType: DocType;
  sourceUrl: string;
  checksum: string;
  originalPath: string;
  translatedPath: string | null;
  translationMode: 'auto' | 'manual' | 'none';
}

export interface RunConfig {
  suppliers: SupplierCode[];
  mode: 'dry-run' | 'live';
  storageRootDir: string;
  translationMode: 'auto' | 'manual' | 'none';
}
