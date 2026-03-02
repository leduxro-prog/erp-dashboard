import assert from 'node:assert/strict';

import {
  extractSupplierSkuFromEntryPath,
  isSupportedArchiveEntry,
} from '../collection-expander';

function run(): void {
  testExtractSupplierSkuFromEntryPath();
  testIsSupportedArchiveEntry();
}

function testExtractSupplierSkuFromEntryPath(): void {
  assert.equal(extractSupplierSkuFromEntryPath('folder/AZ0311-manual.pdf'), 'AZ0311');
  assert.equal(extractSupplierSkuFromEntryPath('images/AZ 1200 front.jpg'), 'AZ1200');
  assert.equal(extractSupplierSkuFromEntryPath('misc/no-sku-file.pdf'), null);
}

function testIsSupportedArchiveEntry(): void {
  assert.equal(isSupportedArchiveEntry('docs/AZ0311.pdf'), true);
  assert.equal(isSupportedArchiveEntry('drawings/AZ0311.dwg'), true);
  assert.equal(isSupportedArchiveEntry('models/AZ0311.glb'), true);
  assert.equal(isSupportedArchiveEntry('notes/readme.txt'), false);
}

run();
