import fs from 'fs';
import path from 'path';

import { describe, expect, it } from '@jest/globals';

import {
  classifyAssetByMime,
  shouldUseSignedAccess,
  validateAssetRef,
} from '../../src/catalog/asset-reference-policy';

describe('AssetReferencePolicy', () => {
  it('asset class schema includes all required business asset classes', () => {
    const schemaPath = path.join(__dirname, '..', '..', 'contracts', 'published-asset-ref-v1.schema.json');
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      properties: { assetClass: { enum: string[] } };
    };
    const classes = schema.properties.assetClass.enum;
    const required = [
      'primary-image',
      'gallery-image',
      'supplier-asset',
      'datasheet',
      'certificate',
      'installation-document',
      'warranty-document',
      'compliance-document',
    ];

    for (const item of required) {
      expect(classes).toContain(item);
    }
  });

  it('validateAssetRef accepts valid asset reference', () => {
    const asset = {
      assetClass: 'datasheet',
      url: 'https://cdn.ledux.ro/products/p-1/documents/datasheet/2/spec.pdf',
      checksum: 'abc123def456',
      mimeType: 'application/pdf',
      sizeBytes: 123456,
      version: 2,
      access: 'public',
      origin: 'erp',
      updatedAt: '2026-03-14T12:00:00Z',
    };

    expect(validateAssetRef(asset)).toBe(true);
  });

  it('validateAssetRef rejects non-http URL', () => {
    expect(() =>
      validateAssetRef({
        assetClass: 'datasheet',
        url: 's3://bucket/private.pdf',
        checksum: 'abc123def456',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        version: 1,
        access: 'signed',
        origin: 'supplier',
        updatedAt: '2026-03-14T12:00:00Z',
      }),
    ).toThrow(/http\/https/);
  });

  it('signed access policy is required for restricted asset classes', () => {
    expect(shouldUseSignedAccess('supplier-asset')).toBe(true);
    expect(shouldUseSignedAccess('compliance-document')).toBe(true);
    expect(shouldUseSignedAccess('primary-image')).toBe(false);
  });

  it('mime classifier distinguishes image and pdf', () => {
    expect(classifyAssetByMime('image/webp')).toBe('image');
    expect(classifyAssetByMime('application/pdf')).toBe('pdf');
    expect(classifyAssetByMime('application/octet-stream')).toBe('other');
  });

  it('validateAssetRef throws on missing required fields', () => {
    const base = {
      assetClass: 'datasheet',
      url: 'https://cdn.ledux.ro/products/p-1/documents/datasheet/2/spec.pdf',
      checksum: 'abc123def456',
      mimeType: 'application/pdf',
      sizeBytes: 123456,
      version: 2,
      access: 'public',
      origin: 'erp',
      updatedAt: '2026-03-14T12:00:00Z',
    };

    const requiredFields = [
      'assetClass',
      'url',
      'checksum',
      'mimeType',
      'sizeBytes',
      'version',
      'access',
      'origin',
      'updatedAt',
    ] as const;

    for (const field of requiredFields) {
      const withoutField = Object.fromEntries(
        Object.entries(base).filter(([k]) => k !== field),
      );
      expect(() => validateAssetRef(withoutField)).toThrow(`Missing required asset field: ${field}`);
    }
  });

  it('validateAssetRef rejects invalid access value', () => {
    expect(() =>
      validateAssetRef({
        assetClass: 'datasheet',
        url: 'https://cdn.ledux.ro/products/p-1/documents/datasheet/2/spec.pdf',
        checksum: 'abc123def456',
        mimeType: 'application/pdf',
        sizeBytes: 123456,
        version: 2,
        access: 'private',
        origin: 'erp',
        updatedAt: '2026-03-14T12:00:00Z',
      }),
    ).toThrow('Asset access must be public or signed');
  });

  it('validateAssetRef rejects invalid origin value', () => {
    expect(() =>
      validateAssetRef({
        assetClass: 'datasheet',
        url: 'https://cdn.ledux.ro/products/p-1/documents/datasheet/2/spec.pdf',
        checksum: 'abc123def456',
        mimeType: 'application/pdf',
        sizeBytes: 123456,
        version: 2,
        access: 'public',
        origin: 'unknown',
        updatedAt: '2026-03-14T12:00:00Z',
      }),
    ).toThrow('Asset origin must be erp, supplier, or derived');
  });

  it('validateAssetRef rejects public access for restricted asset classes', () => {
    expect(() =>
      validateAssetRef({
        assetClass: 'supplier-asset',
        url: 'https://cdn.ledux.ro/suppliers/s-1/documents/private.pdf',
        checksum: 'abc123def456',
        mimeType: 'application/pdf',
        sizeBytes: 123456,
        version: 2,
        access: 'public',
        origin: 'supplier',
        updatedAt: '2026-03-14T12:00:00Z',
      }),
    ).toThrow('Asset class supplier-asset requires signed access');
  });
});
