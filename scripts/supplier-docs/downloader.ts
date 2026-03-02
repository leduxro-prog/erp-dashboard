import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface DownloadOptions {
  timeoutMs?: number;
  retries?: number;
  maxBytes?: number;
  retryDelayMs?: number;
  fetchImpl?: typeof fetch;
}

export interface DownloadResult {
  destinationPath: string;
  bytesWritten: number;
  attempts: number;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_RETRY_DELAY_MS = 100;

export async function downloadToFile(
  url: string,
  destinationPath: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? DEFAULT_RETRIES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const fetchImpl = options.fetchImpl ?? fetch;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    try {
      const bytes = await downloadAttempt(fetchImpl, url, destinationPath, timeoutMs, maxBytes);
      return { destinationPath, bytesWritten: bytes, attempts: attempt };
    } catch (error) {
      const normalizedError = normalizeError(error);
      lastError = normalizedError;

      if (isMaxSizeError(normalizedError)) {
        break;
      }

      if (attempt <= retries) {
        await sleep(retryDelayMs);
      }
    }
  }

  throw lastError ?? new Error('Download failed');
}

async function downloadAttempt(
  fetchImpl: typeof fetch,
  url: string,
  destinationPath: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<number> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`);
    }

    const lengthHeader = response.headers.get('content-length');
    if (lengthHeader) {
      const declaredSize = Number(lengthHeader);
      if (!Number.isNaN(declaredSize) && declaredSize > maxBytes) {
        throw new Error(`Download exceeds max size of ${maxBytes} bytes`);
      }
    }

    const buffer = await readBodyWithSizeGuard(response, maxBytes);
    await persistBuffer(destinationPath, buffer);
    return buffer.byteLength;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Download timed out after ${timeoutMs}ms`);
    }

    throw normalizeError(error);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readBodyWithSizeGuard(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.byteLength > maxBytes) {
      throw new Error(`Download exceeds max size of ${maxBytes} bytes`);
    }

    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = Buffer.from(value);
    totalBytes += chunk.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error(`Download exceeds max size of ${maxBytes} bytes`);
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

async function persistBuffer(destinationPath: string, buffer: Buffer): Promise<void> {
  const directory = path.dirname(destinationPath);
  await mkdir(directory, { recursive: true });

  const tempPath = `${destinationPath}.part`;
  await writeFile(tempPath, buffer);
  await rename(tempPath, destinationPath);
}

function isMaxSizeError(error: Error): boolean {
  return /max size/i.test(error.message);
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
