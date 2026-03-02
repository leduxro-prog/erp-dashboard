import assert from 'node:assert/strict';

import {
  choosePrimaryDocUrl,
  mergeSupplierDocsMetadata,
  mergeSupplierDocsIntoCustomSpecs,
} from '../db-attach';
import type { SupplierDocMetadata } from '../db-attach';

function run(): void {
  testChoosePrimaryDocUrlPrefersTranslated();
  testChoosePrimaryDocUrlFallsBackToOriginal();
  testMergeSupplierDocsMetadataAppendsAndReplacesDeterministically();
  testMergeSupplierDocsIntoCustomSpecsPreservesOtherFields();
}

function testChoosePrimaryDocUrlPrefersTranslated(): void {
  assert.equal(
    choosePrimaryDocUrl({ translated: 'https://cdn.local/manual-ro.pdf', original: 'https://cdn.local/manual-en.pdf' }),
    'https://cdn.local/manual-ro.pdf',
  );
}

function testChoosePrimaryDocUrlFallsBackToOriginal(): void {
  assert.equal(
    choosePrimaryDocUrl({ translated: null, original: 'https://cdn.local/datasheet-en.pdf' }),
    'https://cdn.local/datasheet-en.pdf',
  );
  assert.equal(choosePrimaryDocUrl({ translated: '   ', original: '   ' }), null);
}

function testMergeSupplierDocsMetadataAppendsAndReplacesDeterministically(): void {
  const existing = [
    {
      source_url: 'https://docs.example.com/a.pdf',
      checksum: 'aaa',
      doc_type: 'datasheet',
      primary_url: 'https://cdn.local/a-ro.pdf',
    },
    {
      source_url: 'https://docs.example.com/c.pdf',
      checksum: 'ccc',
      doc_type: 'installation_guide',
      primary_url: 'https://cdn.local/c-en.pdf',
    },
  ];

  const incoming: SupplierDocMetadata[] = [
    {
      source_url: 'https://docs.example.com/b.pdf',
      checksum: 'bbb',
      doc_type: 'datasheet',
      primary_url: 'https://cdn.local/b-ro.pdf',
    },
    {
      source_url: 'https://docs.example.com/a.pdf',
      checksum: 'aaa',
      doc_type: 'datasheet',
      primary_url: 'https://cdn.local/a-en.pdf',
    },
  ];

  assert.deepEqual(mergeSupplierDocsMetadata(existing, incoming), [
    {
      source_url: 'https://docs.example.com/a.pdf',
      checksum: 'aaa',
      doc_type: 'datasheet',
      primary_url: 'https://cdn.local/a-en.pdf',
    },
    {
      source_url: 'https://docs.example.com/b.pdf',
      checksum: 'bbb',
      doc_type: 'datasheet',
      primary_url: 'https://cdn.local/b-ro.pdf',
    },
    {
      source_url: 'https://docs.example.com/c.pdf',
      checksum: 'ccc',
      doc_type: 'installation_guide',
      primary_url: 'https://cdn.local/c-en.pdf',
    },
  ]);
}

function testMergeSupplierDocsIntoCustomSpecsPreservesOtherFields(): void {
  const existingCustomSpecs = {
    voltage: '220V',
    supplierDocs: [
      {
        source_url: 'https://docs.example.com/a.pdf',
        checksum: 'aaa',
        doc_type: 'datasheet',
        primary_url: 'https://cdn.local/a-ro.pdf',
      },
    ],
  };

  const merged = mergeSupplierDocsIntoCustomSpecs(existingCustomSpecs, [
    {
      source_url: 'https://docs.example.com/d.pdf',
      checksum: 'ddd',
      doc_type: 'installation_guide',
      primary_url: 'https://cdn.local/d-ro.pdf',
    },
  ]);

  assert.equal(merged.voltage, '220V');
  assert.equal(Array.isArray(merged.supplierDocs), true);
  assert.equal((merged.supplierDocs as unknown[]).length, 2);
}

run();
