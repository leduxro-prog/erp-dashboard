import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { downloadToFile } from '../downloader';
import { AutoTranslatorAdapter, buildTranslatedName } from '../translator';

async function run(): Promise<void> {
  testBuildTranslatedName();
  await testAutoTranslatorCopiesAndPreservesOriginal();
  await testAutoTranslatorReturnsNullOnFailure();
  await testDownloaderRetriesAndSavesFile();
  await testDownloaderRejectsOversizedPayload();
  await testDownloaderTimesOut();
}

function testBuildTranslatedName(): void {
  assert.equal(buildTranslatedName('manual.pdf'), 'manual-ro-auto.pdf');
  assert.equal(buildTranslatedName('manual'), 'manual-ro-auto');
}

async function testAutoTranslatorCopiesAndPreservesOriginal(): Promise<void> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'supplier-docs-translator-'));

  try {
    const sourcePath = path.join(tempDir, 'manual.pdf');
    await writeFile(sourcePath, 'original-content', 'utf8');

    const translator = new AutoTranslatorAdapter();
    const translatedPath = await translator.translate(sourcePath, 'en', 'ro');

    assert.equal(translatedPath, path.join(tempDir, 'manual-ro-auto.pdf'));
    assert.equal(await readFile(sourcePath, 'utf8'), 'original-content');
    assert.equal(await readFile(translatedPath as string, 'utf8'), 'original-content');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function testAutoTranslatorReturnsNullOnFailure(): Promise<void> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'supplier-docs-translator-failure-'));

  try {
    const sourcePath = path.join(tempDir, 'manual.pdf');
    await writeFile(sourcePath, 'content', 'utf8');

    const translator = new AutoTranslatorAdapter({
      translateFile: async () => {
        throw new Error('translation service unavailable');
      },
    });

    const translatedPath = await translator.translate(sourcePath, 'en', 'ro');
    assert.equal(translatedPath, null);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function testDownloaderRetriesAndSavesFile(): Promise<void> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'supplier-docs-downloader-'));

  try {
    const outputPath = path.join(tempDir, 'manual.pdf');
    let attempts = 0;

    const result = await downloadToFile('https://example.com/manual.pdf', outputPath, {
      retries: 2,
      timeoutMs: 200,
      fetchImpl: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error('transient network error');
        }

        return new Response('pdf-content', {
          status: 200,
          headers: { 'content-length': '11' },
        });
      },
    });

    assert.equal(attempts, 2);
    assert.equal(result.attempts, 2);
    assert.equal(result.bytesWritten, 11);
    assert.equal(await readFile(outputPath, 'utf8'), 'pdf-content');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function testDownloaderRejectsOversizedPayload(): Promise<void> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'supplier-docs-downloader-size-'));

  try {
    const outputPath = path.join(tempDir, 'manual.pdf');

    await assert.rejects(
      () =>
        downloadToFile('https://example.com/manual.pdf', outputPath, {
          maxBytes: 4,
          retries: 0,
          fetchImpl: async () =>
            new Response('12345', {
              status: 200,
              headers: { 'content-length': '5' },
            }),
        }),
      /max size/i,
    );

    await assert.rejects(() => stat(outputPath));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function testDownloaderTimesOut(): Promise<void> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'supplier-docs-downloader-timeout-'));

  try {
    const outputPath = path.join(tempDir, 'manual.pdf');

    await assert.rejects(
      () =>
        downloadToFile('https://example.com/manual.pdf', outputPath, {
          timeoutMs: 25,
          retries: 0,
          fetchImpl: (_url, init) =>
            new Promise((_resolve, reject) => {
              const signal = init?.signal;
              if (signal) {
                signal.addEventListener('abort', () => {
                  reject(new Error('aborted'));
                });
              }
            }),
        }),
      /timed out/i,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
