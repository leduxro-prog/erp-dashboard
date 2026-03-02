import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

import { computeFileSha256 } from '../checksum';
import { buildDocPaths } from '../storage';

const docPaths = buildDocPaths('/tmp/uploads', 'azzardo', 'AZ0311', 'manual.pdf');

assert.equal(
  docPaths.originalPath,
  path.join('/tmp/uploads', 'azzardo', 'AZ0311', 'original', 'manual.pdf'),
);
assert.equal(
  docPaths.translatedPath,
  path.join('/tmp/uploads', 'azzardo', 'AZ0311', 'ro-auto', 'manual-ro-auto.pdf'),
);

const unsafePaths = buildDocPaths('/tmp/uploads', 'azzardo', '../AZ/03:11', '../../manual?.pdf');
assert.equal(unsafePaths.originalPath.includes('..'), false);
assert.equal(path.basename(unsafePaths.originalPath), 'manual.pdf');
assert.equal(path.basename(unsafePaths.translatedPath), 'manual-ro-auto.pdf');

async function run(): Promise<void> {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'supplier-docs-checksum-'));

  try {
    const filePath = path.join(tempDir, 'sample.txt');
    const fileContent = 'checksum target';

    await writeFile(filePath, fileContent, 'utf8');

    const expectedDigest = createHash('sha256').update(fileContent, 'utf8').digest('hex');
    const actualDigest = await computeFileSha256(filePath);

    assert.equal(actualDigest, expectedDigest);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

void run().catch((error) => {
  throw error;
});
