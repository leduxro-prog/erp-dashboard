import path from 'node:path';
import { createReadStream } from 'node:fs';

import { Pool } from 'pg';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { computeFileSha256 } from './supplier-docs/checksum';
import { buildConfig } from './supplier-docs/config';
import { attachDocsToProductSpecifications, type AttachDocsResult } from './supplier-docs/db-attach';
import { downloadToFile } from './supplier-docs/downloader';
import { expandCollectionArchive, type ExpandedCollectionDoc } from './supplier-docs/collection-expander';
import { fetchAcaDocsForSku } from './supplier-docs/providers/aca-provider';
import { fetchAzzardoDocs } from './supplier-docs/providers/azzardo-provider';
import { buildDocPaths } from './supplier-docs/storage';
import { AutoTranslatorAdapter } from './supplier-docs/translator';
import type { AttachableSupplierDoc } from './supplier-docs/db-attach';
import type { DiscoveredDoc, DocType, SupplierCode } from './supplier-docs/types';

const ALL_SUPPLIERS: SupplierCode[] = ['azzardo', 'aca'];

export interface CliArgs {
  suppliers: SupplierCode[];
  dryRun: boolean;
  limit: number | null;
  resume: boolean;
}

export type SupplierDocCandidate = DiscoveredDoc;

export interface OrchestratorSummary {
  suppliersRequested: number;
  suppliersSucceeded: number;
  suppliersFailed: number;
  discovered: number;
  downloaded: number;
  translated: number;
  attached: number;
  productNotFound: number;
  failures: number;
  dryRun: boolean;
  limit: number | null;
  resume: boolean;
}

export interface DiscoverDocsInput {
  supplier: SupplierCode;
  limit: number | null;
  resume: boolean;
}

export interface BuildOriginalPathInput {
  supplier: SupplierCode;
  supplierSku: string;
  fileName: string;
}

export interface OrchestratorDependencies {
  discoverDocsForSupplier(input: DiscoverDocsInput): Promise<SupplierDocCandidate[]>;
  downloadDoc(sourceUrl: string, destinationPath: string): Promise<{ destinationPath: string }>;
  computeChecksum(filePath: string): Promise<string>;
  translateDoc(filePath: string): Promise<string | null>;
  toPublicUrl(filePath: string): string;
  publishFile?(filePath: string): Promise<string>;
  getSupplierId(supplier: SupplierCode): Promise<number | null>;
  attachDocs(input: { supplierId: number; supplierSku: string; docs: AttachableSupplierDoc[] }): Promise<AttachDocsResult>;
  expandCollectionDocs?(input: {
    supplier: SupplierCode;
    docType: DocType;
    sourceUrl: string;
    archivePath: string;
  }): Promise<ExpandedCollectionDoc[]>;
  buildOriginalPath(input: BuildOriginalPathInput): string;
  printSummary(summary: OrchestratorSummary): void;
  cleanup?(): Promise<void> | void;
}

export function parseArgs(argv: string[]): CliArgs {
  let suppliers = [...ALL_SUPPLIERS];
  let dryRun = false;
  let limit: number | null = null;
  let resume = false;

  for (const rawArg of argv) {
    if (rawArg === '--dry-run') {
      dryRun = true;
      continue;
    }

    if (rawArg === '--resume') {
      resume = true;
      continue;
    }

    if (rawArg.startsWith('--supplier=')) {
      const parsedSuppliers = parseSuppliersArg(rawArg.slice('--supplier='.length));
      suppliers = parsedSuppliers;
      continue;
    }

    if (rawArg.startsWith('--limit=')) {
      limit = parseLimitArg(rawArg.slice('--limit='.length));
      continue;
    }

    if (rawArg === '--help' || rawArg === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${rawArg}`);
  }

  return {
    suppliers,
    dryRun,
    limit,
    resume,
  };
}

export async function runOrchestrator(
  args: CliArgs,
  dependencies?: OrchestratorDependencies,
): Promise<OrchestratorSummary> {
  const deps = dependencies ?? createDefaultDependencies(args);
  const summary: OrchestratorSummary = {
    suppliersRequested: args.suppliers.length,
    suppliersSucceeded: 0,
    suppliersFailed: 0,
    discovered: 0,
    downloaded: 0,
    translated: 0,
    attached: 0,
    productNotFound: 0,
    failures: 0,
    dryRun: args.dryRun,
    limit: args.limit,
    resume: args.resume,
  };

  let remainingLimit = args.limit;
  let pendingError: unknown;

  try {
    for (const supplier of args.suppliers) {
      let discoveredDocs: SupplierDocCandidate[] = [];

      try {
        discoveredDocs = await deps.discoverDocsForSupplier({ supplier, limit: remainingLimit, resume: args.resume });
        summary.suppliersSucceeded += 1;
      } catch (error) {
        summary.suppliersFailed += 1;
        summary.failures += 1;
        console.error(`[supplier-docs] discovery failed for ${supplier}: ${toErrorMessage(error)}`);
        continue;
      }

      const orderedDocs = [...discoveredDocs].sort(compareDocsDeterministically);
      const limitedDocs =
        remainingLimit === null ? orderedDocs : orderedDocs.slice(0, Math.max(remainingLimit, 0));

      summary.discovered += limitedDocs.length;

      if (remainingLimit !== null) {
        remainingLimit = Math.max(remainingLimit - limitedDocs.length, 0);
      }

      if (limitedDocs.length === 0 || args.dryRun) {
        if (remainingLimit === 0) {
          break;
        }
        continue;
      }

      let supplierId: number | null;

      try {
        supplierId = await deps.getSupplierId(supplier);
      } catch (error) {
        summary.suppliersFailed += 1;
        summary.failures += 1;
        console.error(`[supplier-docs] supplier id lookup failed for code=${supplier}: ${toErrorMessage(error)}`);
        if (remainingLimit === 0) {
          break;
        }
        continue;
      }

      if (!supplierId) {
        summary.failures += limitedDocs.length;
        console.error(`[supplier-docs] supplier id not found for code=${supplier}`);
        if (remainingLimit === 0) {
          break;
        }
        continue;
      }

      const docsBySku = new Map<string, AttachableSupplierDoc[]>();

      for (const doc of limitedDocs) {
        try {
          const originalPath = deps.buildOriginalPath({
            supplier: doc.supplier,
            supplierSku: doc.supplierSku,
            fileName: doc.fileName,
          });

          const downloaded = await deps.downloadDoc(doc.sourceUrl, originalPath);
          summary.downloaded += 1;

          const checksum = await deps.computeChecksum(downloaded.destinationPath);
          const translatedPath = shouldTranslateDoc(doc.docType)
            ? await deps.translateDoc(downloaded.destinationPath)
            : null;

          const originalUrl = await resolvePublicUrl(deps, downloaded.destinationPath);
          const translatedUrl = translatedPath ? await resolvePublicUrl(deps, translatedPath) : null;

          if (translatedPath) {
            summary.translated += 1;
          }

          const attachableDoc: AttachableSupplierDoc = {
            docType: doc.docType,
            sourceUrl: doc.sourceUrl,
            checksum,
            originalUrl,
            translatedUrl,
            translationMode: translatedPath ? 'auto' : 'none',
          };

          if (doc.supplier === 'azzardo' && doc.supplierSku === 'AZZARDO_COLLECTION' && deps.expandCollectionDocs) {
            const expandedDocs = await deps.expandCollectionDocs({
              supplier: doc.supplier,
              docType: doc.docType,
              sourceUrl: doc.sourceUrl,
              archivePath: downloaded.destinationPath,
            });

            for (const expanded of expandedDocs) {
              if (expanded.translatedPath) {
                summary.translated += 1;
              }

              const expandedAttachableDoc: AttachableSupplierDoc = {
                docType: expanded.docType,
                sourceUrl: expanded.sourceUrl,
                checksum: expanded.checksum,
                originalUrl: await resolvePublicUrl(deps, expanded.originalPath),
                translatedUrl: expanded.translatedPath
                  ? await resolvePublicUrl(deps, expanded.translatedPath)
                  : null,
                translationMode: expanded.translationMode,
              };

              const expandedExisting = docsBySku.get(expanded.supplierSku) ?? [];
              expandedExisting.push(expandedAttachableDoc);
              docsBySku.set(expanded.supplierSku, expandedExisting);
            }

            continue;
          }

          const existing = docsBySku.get(doc.supplierSku) ?? [];
          existing.push(attachableDoc);
          docsBySku.set(doc.supplierSku, existing);
        } catch (error) {
          summary.failures += 1;
          console.error(
            `[supplier-docs] document processing failed for ${doc.supplier}/${doc.supplierSku} (${doc.sourceUrl}): ${toErrorMessage(error)}`,
          );
        }
      }

      for (const [supplierSku, docs] of docsBySku.entries()) {
        try {
          const result = await deps.attachDocs({ supplierId, supplierSku, docs });

          if (result.status === 'attached') {
            summary.attached += result.attachedDocsCount;
          }

          if (result.status === 'product_not_found') {
            summary.productNotFound += 1;
          }
        } catch (error) {
          summary.failures += 1;
          console.error(`[supplier-docs] attach failed for ${supplier}/${supplierSku}: ${toErrorMessage(error)}`);
        }
      }

      if (remainingLimit === 0) {
        break;
      }
    }
  } catch (error) {
    pendingError = error;
  } finally {
    try {
      deps.printSummary(summary);
    } catch (error) {
      if (pendingError === undefined) {
        pendingError = error;
      } else {
        console.error(`[supplier-docs] summary printing failed: ${toErrorMessage(error)}`);
      }
    }

    if (deps.cleanup) {
      try {
        await deps.cleanup();
      } catch (error) {
        if (pendingError === undefined) {
          pendingError = error;
        } else {
          console.error(`[supplier-docs] cleanup failed: ${toErrorMessage(error)}`);
        }
      }
    }
  }

  if (pendingError !== undefined) {
    throw pendingError;
  }

  return summary;
}

function parseSuppliersArg(raw: string): SupplierCode[] {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === 'all') {
    return [...ALL_SUPPLIERS];
  }

  const unique = new Set<SupplierCode>();

  for (const token of normalized.split(',')) {
    const value = token.trim();
    if (!value) {
      continue;
    }

    if (value !== 'azzardo' && value !== 'aca') {
      throw new Error(`Invalid supplier code: ${value}`);
    }

    unique.add(value);
  }

  if (unique.size === 0) {
    return [...ALL_SUPPLIERS];
  }

  return [...unique];
}

function parseLimitArg(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`Invalid --limit value: ${raw}. Expected a positive integer.`);
  }

  return parsed;
}

function shouldTranslateDoc(docType: DocType): boolean {
  return docType === 'datasheet' || docType === 'installation_guide';
}

function compareDocsDeterministically(left: SupplierDocCandidate, right: SupplierDocCandidate): number {
  return `${left.supplier}|${left.supplierSku}|${left.docType}|${left.sourceUrl}|${left.fileName}`.localeCompare(
    `${right.supplier}|${right.supplierSku}|${right.docType}|${right.sourceUrl}|${right.fileName}`,
  );
}

function createDefaultDependencies(args: CliArgs): OrchestratorDependencies {
  const cfg = buildConfig({
    suppliers: args.suppliers.join(','),
    mode: args.dryRun ? 'dry-run' : 'live',
  });

  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'cypher_erp',
    user: process.env.DB_USER || process.env.DB_USERNAME || 'cypher_user',
    password: process.env.DB_PASSWORD || 'cypher_secret_change_me',
  });

  const translator = new AutoTranslatorAdapter();
  const supplierIdCache = new Map<SupplierCode, number | null>();
  const maxDownloadBytes = Number(process.env.SUPPLIER_DOC_MAX_BYTES || 2 * 1024 * 1024 * 1024);
  const downloadTimeoutMs = Number(process.env.SUPPLIER_DOC_TIMEOUT_MS || 20 * 60 * 1000);
  const downloadRetries = Number(process.env.SUPPLIER_DOC_RETRIES || 1);
  const expandedCollectionsRoot = path.join(cfg.storageRootDir, '_collections');
  const storageDriver = (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();
  const objectStorage = storageDriver === 's3' ? createS3PublisherFromEnv() : null;

  return {
    discoverDocsForSupplier: async ({ supplier, limit }) => {
      if (supplier === 'azzardo') {
        return fetchAzzardoDocs();
      }

      const supplierId = await resolveSupplierId(pool, supplier, supplierIdCache);
      if (!supplierId) {
        return [];
      }

      const skus = await loadSupplierSkus(pool, supplierId, limit);
      const docs: SupplierDocCandidate[] = [];

      for (const sku of skus) {
        try {
          const discovered = await fetchAcaDocsForSku(sku);
          docs.push(...discovered);
        } catch (error) {
          console.error(`[supplier-docs] ACA discovery failed for sku=${sku}: ${toErrorMessage(error)}`);
        }
      }

      return docs;
    },
    downloadDoc: async (sourceUrl, destinationPath) =>
      downloadToFile(sourceUrl, destinationPath, {
        maxBytes: maxDownloadBytes,
        timeoutMs: downloadTimeoutMs,
        retries: downloadRetries,
      }),
    computeChecksum: async (filePath) => computeFileSha256(filePath),
    translateDoc: async (filePath) => translator.translate(filePath, 'en', 'ro'),
    toPublicUrl: (filePath) => toPublicUploadUrl(filePath),
    publishFile: objectStorage
      ? async (filePath) => {
          const objectKey = buildObjectStorageKey(filePath);
          await objectStorage.upload(filePath, objectKey);
          return objectStorage.toPublicUrl(objectKey);
        }
      : undefined,
    getSupplierId: async (supplier) => resolveSupplierId(pool, supplier, supplierIdCache),
    attachDocs: async ({ supplierId, supplierSku, docs }) => attachDocsToProductSpecifications(pool, { supplierId, supplierSku, docs }),
    expandCollectionDocs: async ({ supplier, docType, sourceUrl, archivePath }) =>
      expandCollectionArchive({
        archivePath,
        sourceUrl,
        docType,
        outputDir: path.join(expandedCollectionsRoot, supplier),
        computeChecksum: async (filePath) => computeFileSha256(filePath),
        translateDoc: async (filePath) => translator.translate(filePath, 'en', 'ro'),
        shouldTranslate: shouldTranslateDoc(docType),
      }),
    buildOriginalPath: ({ supplier, supplierSku, fileName }) =>
      buildDocPaths(cfg.storageRootDir, supplier, supplierSku, fileName).originalPath,
    printSummary: (summary) => {
      printSummary(summary);
    },
    cleanup: async () => {
      await pool.end();
    },
  };
}

async function resolvePublicUrl(deps: OrchestratorDependencies, filePath: string): Promise<string> {
  if (deps.publishFile) {
    return deps.publishFile(filePath);
  }

  return deps.toPublicUrl(filePath);
}

function buildObjectStorageKey(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const uploadsIndex = normalized.indexOf('uploads/');
  if (uploadsIndex >= 0) {
    return normalized.slice(uploadsIndex);
  }

  return normalized.replace(/^\/+/, '');
}

function createS3PublisherFromEnv(): {
  upload(filePath: string, objectKey: string): Promise<void>;
  toPublicUrl(objectKey: string): string;
} {
  const endpoint = requiredEnv('S3_ENDPOINT');
  const region = process.env.S3_REGION || 'us-east-1';
  const bucket = requiredEnv('S3_BUCKET');
  const accessKeyId = requiredEnv('S3_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnv('S3_SECRET_ACCESS_KEY');
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || 'true').toLowerCase() !== 'false';
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL || `${endpoint.replace(/\/$/, '')}/${bucket}`;

  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return {
    upload: async (filePath, objectKey) => {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: createReadStream(filePath),
        }),
      );
    },
    toPublicUrl: (objectKey) => `${publicBaseUrl.replace(/\/$/, '')}/${objectKey.replace(/^\/+/, '')}`,
  };
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function resolveSupplierId(
  pool: Pool,
  supplier: SupplierCode,
  cache: Map<SupplierCode, number | null>,
): Promise<number | null> {
  if (cache.has(supplier)) {
    return cache.get(supplier) ?? null;
  }

  const result = await pool.query<{ id: number }>(
    `SELECT id
     FROM suppliers
     WHERE LOWER(code) = LOWER($1)
       AND deleted_at IS NULL
     LIMIT 1`,
    [supplier],
  );

  const supplierId = Number(result.rows[0]?.id);
  const normalized = Number.isInteger(supplierId) && supplierId > 0 ? supplierId : null;
  cache.set(supplier, normalized);
  return normalized;
}

async function loadSupplierSkus(pool: Pool, supplierId: number, limit: number | null): Promise<string[]> {
  const hasLimit = limit !== null;
  const query = hasLimit
    ? `SELECT DISTINCT sp.supplier_sku
       FROM supplier_products sp
       WHERE sp.supplier_id = $1
         AND sp.is_active = true
         AND sp.supplier_sku IS NOT NULL
         AND BTRIM(sp.supplier_sku) <> ''
       ORDER BY sp.supplier_sku ASC
       LIMIT $2`
    : `SELECT DISTINCT sp.supplier_sku
       FROM supplier_products sp
       WHERE sp.supplier_id = $1
         AND sp.is_active = true
         AND sp.supplier_sku IS NOT NULL
         AND BTRIM(sp.supplier_sku) <> ''
       ORDER BY sp.supplier_sku ASC`;

  const values: unknown[] = hasLimit ? [supplierId, limit] : [supplierId];
  const result = await pool.query<{ supplier_sku: string }>(query, values);
  return result.rows.map((row) => row.supplier_sku);
}

function toPublicUploadUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const uploadsIndex = normalized.lastIndexOf('/uploads/');

  if (uploadsIndex >= 0) {
    return normalized.slice(uploadsIndex);
  }

  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  return normalized;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function printSummary(summary: OrchestratorSummary): void {
  const limitLabel = summary.limit === null ? 'none' : String(summary.limit);

  console.log('[supplier-docs] run summary');
  console.log(`  suppliers_requested=${summary.suppliersRequested}`);
  console.log(`  suppliers_succeeded=${summary.suppliersSucceeded}`);
  console.log(`  suppliers_failed=${summary.suppliersFailed}`);
  console.log(`  discovered=${summary.discovered}`);
  console.log(`  downloaded=${summary.downloaded}`);
  console.log(`  translated=${summary.translated}`);
  console.log(`  attached=${summary.attached}`);
  console.log(`  product_not_found=${summary.productNotFound}`);
  console.log(`  failures=${summary.failures}`);
  console.log(`  dry_run=${summary.dryRun}`);
  console.log(`  limit=${limitLabel}`);
  console.log(`  resume=${summary.resume}`);
}

function printUsage(): void {
  console.log('Supplier docs backfill orchestrator');
  console.log('');
  console.log('Usage:');
  console.log('  npx ts-node scripts/backfill-supplier-docs.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  --supplier=azzardo|aca|all|azzardo,aca');
  console.log('  --dry-run');
  console.log('  --limit=<number>');
  console.log('  --resume');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  await runOrchestrator(args);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[supplier-docs] fatal: ${toErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
