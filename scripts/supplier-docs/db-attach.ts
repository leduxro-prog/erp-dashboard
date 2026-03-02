import type { DocType } from './types';

export interface PrimaryDocCandidates {
  translated: string | null | undefined;
  original: string | null | undefined;
}

export interface SupplierDocMetadata {
  source_url: string;
  checksum: string;
  doc_type?: DocType;
  original_url?: string | null;
  translated_url?: string | null;
  primary_url?: string | null;
  translation_mode?: 'auto' | 'manual' | 'none';
}

export interface AttachableSupplierDoc {
  docType: DocType;
  sourceUrl: string;
  checksum: string;
  originalUrl: string | null;
  translatedUrl: string | null;
  translationMode?: 'auto' | 'manual' | 'none';
}

export interface AttachDocsInput {
  supplierId: number;
  supplierSku: string;
  docs: AttachableSupplierDoc[];
}

export interface AttachDocsResult {
  status: 'attached' | 'product_not_found' | 'no_docs';
  productId: number | null;
  datasheetUrl: string | null;
  installationGuideUrl: string | null;
  attachedDocsCount: number;
}

export interface QueryResultRow {
  [key: string]: unknown;
}

export interface QueryableDb {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
}

interface ProductIdRow extends QueryResultRow {
  product_id: number;
}

interface ProductSpecificationRow extends QueryResultRow {
  datasheet_url: string | null;
  installation_guide_url: string | null;
  custom_specs: unknown;
}

export function choosePrimaryDocUrl({ translated, original }: PrimaryDocCandidates): string | null {
  const normalizedTranslated = normalizeNonEmptyString(translated);
  if (normalizedTranslated) {
    return normalizedTranslated;
  }

  return normalizeNonEmptyString(original);
}

export function buildSupplierDocMetadataKey(doc: Pick<SupplierDocMetadata, 'source_url' | 'checksum'>): string {
  return `${doc.source_url}::${doc.checksum}`;
}

export function mergeSupplierDocsMetadata(existing: unknown, incoming: SupplierDocMetadata[]): SupplierDocMetadata[] {
  const mergedByKey = new Map<string, SupplierDocMetadata>();

  for (const doc of readSupplierDocArray(existing)) {
    mergedByKey.set(buildSupplierDocMetadataKey(doc), doc);
  }

  for (const doc of incoming) {
    const normalized = normalizeSupplierDocMetadata(doc);
    if (normalized) {
      mergedByKey.set(buildSupplierDocMetadataKey(normalized), normalized);
    }
  }

  return [...mergedByKey.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value);
}

export function mergeSupplierDocsIntoCustomSpecs(
  existingCustomSpecs: unknown,
  incomingDocs: SupplierDocMetadata[],
): Record<string, unknown> {
  const base = asRecord(existingCustomSpecs);
  const mergedSupplierDocs = mergeSupplierDocsMetadata(base.supplierDocs, incomingDocs);
  return {
    ...base,
    supplierDocs: mergedSupplierDocs,
  };
}

export async function attachDocsToProductSpecifications(
  db: QueryableDb,
  input: AttachDocsInput,
): Promise<AttachDocsResult> {
  if (input.docs.length === 0) {
    return {
      status: 'no_docs',
      productId: null,
      datasheetUrl: null,
      installationGuideUrl: null,
      attachedDocsCount: 0,
    };
  }

  const productId = await resolveProductIdBySupplierSku(db, input.supplierId, input.supplierSku);
  if (!productId) {
    return {
      status: 'product_not_found',
      productId: null,
      datasheetUrl: null,
      installationGuideUrl: null,
      attachedDocsCount: 0,
    };
  }

  const existingSpec = await getExistingSpecification(db, productId);

  const datasheetDoc = chooseDocForType(input.docs, 'datasheet');
  const installationGuideDoc = chooseDocForType(input.docs, 'installation_guide');

  const datasheetUrl =
    choosePrimaryDocUrl({
      translated: datasheetDoc?.translatedUrl,
      original: datasheetDoc?.originalUrl,
    }) ?? existingSpec?.datasheet_url ?? null;

  const installationGuideUrl =
    choosePrimaryDocUrl({
      translated: installationGuideDoc?.translatedUrl,
      original: installationGuideDoc?.originalUrl,
    }) ?? existingSpec?.installation_guide_url ?? null;

  const incomingMetadata = input.docs
    .map(buildSupplierDocMetadata)
    .filter((doc): doc is SupplierDocMetadata => doc !== null);

  const mergedCustomSpecs = mergeSupplierDocsIntoCustomSpecs(existingSpec?.custom_specs ?? {}, incomingMetadata);

  await db.query(
    `INSERT INTO product_specifications (
       product_id,
       datasheet_url,
       installation_guide_url,
       custom_specs,
       created_at,
       updated_at
     )
     VALUES ($1, $2, $3, $4::jsonb, NOW(), NOW())
     ON CONFLICT (product_id) DO UPDATE
     SET datasheet_url = EXCLUDED.datasheet_url,
         installation_guide_url = EXCLUDED.installation_guide_url,
         custom_specs = EXCLUDED.custom_specs,
         updated_at = NOW()`,
    [productId, datasheetUrl, installationGuideUrl, JSON.stringify(mergedCustomSpecs)],
  );

  return {
    status: 'attached',
    productId,
    datasheetUrl,
    installationGuideUrl,
    attachedDocsCount: incomingMetadata.length,
  };
}

async function resolveProductIdBySupplierSku(
  db: QueryableDb,
  supplierId: number,
  supplierSku: string,
): Promise<number | null> {
  const result = await db.query<ProductIdRow>(
    `SELECT sp.product_id
     FROM supplier_products sp
     WHERE sp.supplier_id = $1
       AND sp.supplier_sku = $2
     ORDER BY sp.is_active DESC, sp.updated_at DESC NULLS LAST
     LIMIT 1`,
    [supplierId, supplierSku],
  );

  const productId = Number(result.rows[0]?.product_id);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

async function getExistingSpecification(
  db: QueryableDb,
  productId: number,
): Promise<ProductSpecificationRow | null> {
  const result = await db.query<ProductSpecificationRow>(
    `SELECT datasheet_url, installation_guide_url, custom_specs
     FROM product_specifications
     WHERE product_id = $1
     LIMIT 1`,
    [productId],
  );

  return result.rows[0] ?? null;
}

function chooseDocForType(docs: AttachableSupplierDoc[], docType: DocType): AttachableSupplierDoc | null {
  const candidates = docs
    .filter((doc) => doc.docType === docType)
    .sort((left, right) => {
      const leftKey = `${left.sourceUrl}::${left.checksum}`;
      const rightKey = `${right.sourceUrl}::${right.checksum}`;
      return leftKey.localeCompare(rightKey);
    });

  if (candidates.length === 0) {
    return null;
  }

  return candidates[candidates.length - 1];
}

function buildSupplierDocMetadata(doc: AttachableSupplierDoc): SupplierDocMetadata | null {
  const sourceUrl = normalizeNonEmptyString(doc.sourceUrl);
  const checksum = normalizeNonEmptyString(doc.checksum);
  if (!sourceUrl || !checksum) {
    return null;
  }

  return {
    source_url: sourceUrl,
    checksum,
    doc_type: doc.docType,
    original_url: normalizeNonEmptyString(doc.originalUrl),
    translated_url: normalizeNonEmptyString(doc.translatedUrl),
    primary_url: choosePrimaryDocUrl({
      translated: doc.translatedUrl,
      original: doc.originalUrl,
    }),
    translation_mode: doc.translationMode,
  };
}

function readSupplierDocArray(value: unknown): SupplierDocMetadata[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized: SupplierDocMetadata[] = [];
  for (const item of value) {
    const parsed = normalizeSupplierDocMetadata(item);
    if (parsed) {
      normalized.push(parsed);
    }
  }

  return normalized;
}

function normalizeSupplierDocMetadata(value: unknown): SupplierDocMetadata | null {
  if (!isRecord(value)) {
    return null;
  }

  const sourceUrl = normalizeNonEmptyString(value.source_url);
  const checksum = normalizeNonEmptyString(value.checksum);

  if (!sourceUrl || !checksum) {
    return null;
  }

  const normalized: SupplierDocMetadata = {
    source_url: sourceUrl,
    checksum,
  };

  const docType = normalizeDocType(value.doc_type);
  if (docType) {
    normalized.doc_type = docType;
  }

  const originalUrl = normalizeNonEmptyString(value.original_url);
  if (originalUrl !== null) {
    normalized.original_url = originalUrl;
  }

  const translatedUrl = normalizeNonEmptyString(value.translated_url);
  if (translatedUrl !== null) {
    normalized.translated_url = translatedUrl;
  }

  const primaryUrl = normalizeNonEmptyString(value.primary_url);
  if (primaryUrl !== null) {
    normalized.primary_url = primaryUrl;
  }

  const translationMode = normalizeTranslationMode(value.translation_mode);
  if (translationMode) {
    normalized.translation_mode = translationMode;
  }

  return normalized;
}

function normalizeDocType(value: unknown): DocType | null {
  return value === 'datasheet' || value === 'installation_guide' ? value : null;
}

function normalizeTranslationMode(value: unknown): 'auto' | 'manual' | 'none' | null {
  return value === 'auto' || value === 'manual' || value === 'none' ? value : null;
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    return {};
  }

  return { ...value };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
