import { mkdir, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import { sanitizeFileName, sanitizePathSegment } from './storage';
import type { DocType } from './types';

const execFileAsync = promisify(execFile);

const SUPPORTED_ARCHIVE_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.dwg',
  '.dxf',
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.svg',
  '.obj',
  '.fbx',
  '.3ds',
  '.stl',
  '.glb',
  '.gltf',
  '.ies',
  '.ldt',
]);

export interface ExpandedCollectionDoc {
  supplierSku: string;
  docType: DocType;
  sourceUrl: string;
  checksum: string;
  originalPath: string;
  translatedPath: string | null;
  translationMode: 'auto' | 'manual' | 'none';
}

export interface ExpandCollectionArchiveInput {
  archivePath: string;
  sourceUrl: string;
  docType: DocType;
  outputDir: string;
  computeChecksum(filePath: string): Promise<string>;
  translateDoc(filePath: string): Promise<string | null>;
  shouldTranslate: boolean;
}

export async function expandCollectionArchive(input: ExpandCollectionArchiveInput): Promise<ExpandedCollectionDoc[]> {
  const entries = await listArchiveEntries(input.archivePath);
  const docs: ExpandedCollectionDoc[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (!isSafeArchiveEntry(entry) || !isSupportedArchiveEntry(entry)) {
      continue;
    }

    const supplierSku = extractSupplierSkuFromEntryPath(entry);
    if (!supplierSku) {
      continue;
    }

    const extractedPath = buildExtractedPath(input.outputDir, supplierSku, entry);
    await extractArchiveEntry(input.archivePath, entry, extractedPath);

    const checksum = await input.computeChecksum(extractedPath);
    const translatedPath = input.shouldTranslate ? await input.translateDoc(extractedPath) : null;
    const dedupeKey = `${supplierSku}|${input.docType}|${checksum}`;

    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);

    docs.push({
      supplierSku,
      docType: input.docType,
      sourceUrl: input.sourceUrl,
      checksum,
      originalPath: extractedPath,
      translatedPath,
      translationMode: translatedPath ? 'auto' : 'none',
    });
  }

  return docs;
}

export function extractSupplierSkuFromEntryPath(entryPath: string): string | null {
  const match = entryPath.match(/\b(AZ[-_ ]?\d{3,6}[A-Z0-9]*)\b/i);
  if (!match) {
    return null;
  }

  return match[1].toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isSupportedArchiveEntry(entryPath: string): boolean {
  const ext = path.extname(entryPath).toLowerCase();
  return SUPPORTED_ARCHIVE_EXTENSIONS.has(ext);
}

function isSafeArchiveEntry(entryPath: string): boolean {
  if (!entryPath || entryPath.includes('..') || entryPath.startsWith('/')) {
    return false;
  }

  return !path.isAbsolute(entryPath);
}

function buildExtractedPath(outputDir: string, supplierSku: string, entryPath: string): string {
  const safeSku = sanitizePathSegment(supplierSku);
  const flattened = sanitizeFileName(entryPath.replace(/[\\/]+/g, '-'));
  return path.resolve(outputDir, safeSku, flattened);
}

async function listArchiveEntries(archivePath: string): Promise<string[]> {
  const { stdout } = await execFileAsync('unzip', ['-Z1', archivePath], { maxBuffer: 20 * 1024 * 1024 });
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.endsWith('/'));
}

async function extractArchiveEntry(archivePath: string, entryPath: string, destinationPath: string): Promise<void> {
  const { stdout } = await execFileAsync('unzip', ['-p', archivePath, escapeUnzipPattern(entryPath)], {
    maxBuffer: 200 * 1024 * 1024,
    encoding: 'buffer',
  });
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, stdout as Buffer);
}

function escapeUnzipPattern(entryPath: string): string {
  return entryPath.replace(/([\[\]\?\*])/g, '\\$1');
}
