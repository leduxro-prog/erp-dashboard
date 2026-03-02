import path from 'node:path';

import { Pool } from 'pg';

import { computeFileSha256 } from './supplier-docs/checksum';
import { buildConfig } from './supplier-docs/config';
import { attachDocsToProductSpecifications, type AttachDocsResult } from './supplier-docs/db-attach';
import { downloadToFile } from './supplier-docs/downloader';
import { fetchAcaDocsForSku } from './supplier-docs/providers/aca-provider';
import { fetchAzzardoDocs } from './supplier-docs/providers/azzardo-provider';
import { buildDocPaths } from './supplier-docs/storage';
import { AutoTranslatorAdapter } from './supplier-docs/translator';
import type { AttachableSupplierDoc } from './supplier-docs/db-attach';
import type { DiscoveredDoc, SupplierCode } from './supplier-docs/types';

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
  getSupplierId(supplier: SupplierCode): Promise<number | null>;
  attachDocs(input: { supplierId: number; supplierSku: string; docs: AttachableSupplierDoc[] }): Promise<AttachDocsResult>;
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
          const translatedPath = await deps.translateDoc(downloaded.destinationPath);

          if (translatedPath) {
            summary.translated += 1;
          }

          const attachableDoc: AttachableSupplierDoc = {
            docType: doc.docType,
            sourceUrl: doc.sourceUrl,
            checksum,
            originalUrl: deps.toPublicUrl(downloaded.destinationPath),
            translatedUrl: translatedPath ? deps.toPublicUrl(translatedPath) : null,
            translationMode: translatedPath ? 'auto' : 'none',
          };

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
    downloadDoc: async (sourceUrl, destinationPath) => downloadToFile(sourceUrl, destinationPath),
    computeChecksum: async (filePath) => computeFileSha256(filePath),
    translateDoc: async (filePath) => translator.translate(filePath, 'en', 'ro'),
    toPublicUrl: (filePath) => toPublicUploadUrl(filePath),
    getSupplierId: async (supplier) => resolveSupplierId(pool, supplier, supplierIdCache),
    attachDocs: async ({ supplierId, supplierSku, docs }) => attachDocsToProductSpecifications(pool, { supplierId, supplierSku, docs }),
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
