import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import {
  applyPublicationEvent,
  deepMerge,
  deriveTriggers,
} from '../../src/catalog/published-catalog-projection';

describe('PublishedCatalogProjection', () => {
  it('deepMerge keeps untouched fields while updating nested paths', () => {
    const base = {
      technical: { lumens: 800, kelvin: 3000 },
      visibility: { retail: true, b2b: true },
    };
    const patch = {
      technical: { kelvin: 4000 },
      visibility: { b2b: false },
    };

    const merged = deepMerge(base as Record<string, unknown>, patch as Record<string, unknown>);

    expect((merged.technical as Record<string, unknown>).lumens).toBe(800);
    expect((merged.technical as Record<string, unknown>).kelvin).toBe(4000);
    expect((merged.visibility as Record<string, unknown>).retail).toBe(true);
    expect((merged.visibility as Record<string, unknown>).b2b).toBe(false);
  });

  it('stale event is ignored by sourceVersion', () => {
    const current = {
      productId: 'p-1',
      sku: 'SKU-001',
      erpProductId: 'erp-1',
      sourceVersion: 10,
      projectionVersion: 1,
      lifecycleState: 'published' as const,
      visibility: { retail: true, b2b: true },
      technical: { lumens: 700 },
      media: { primaryImage: null, gallery: [] },
      documents: {
        datasheets: [],
        certificates: [],
        installation: [],
        warranty: [],
        compliance: [],
      },
    };
    const event = {
      eventType: 'catalog.product.upsert-partial',
      source: { sourceVersion: 9 },
      payload: { technical: { lumens: 1000 } },
    };

    const result = applyPublicationEvent(current, event);

    expect(result.applied).toBe(false);
    expect(result.reason).toBe('stale-event');
    expect((result.projection?.technical as Record<string, unknown>).lumens).toBe(700);
  });

  it('partial upsert updates projection and emits triggers', () => {
    const current = {
      productId: 'p-1',
      sku: 'SKU-001',
      erpProductId: 'erp-1',
      sourceVersion: 10,
      projectionVersion: 1,
      lifecycleState: 'published' as const,
      visibility: { retail: true, b2b: true },
      technical: { lumens: 700, kelvin: 3000 },
      media: { primaryImage: null, gallery: [] },
      documents: {
        datasheets: [],
        certificates: [],
        installation: [],
        warranty: [],
        compliance: [],
      },
    };
    const event = {
      eventType: 'catalog.product.upsert-partial',
      source: { sourceVersion: 11 },
      payload: {
        technical: { kelvin: 3500 },
        media: { gallery: [{ url: 'https://cdn.example.com/a.jpg' }] },
        changedPaths: ['technical.kelvin', 'media.gallery'],
      },
    };

    const result = applyPublicationEvent(current, event);

    expect(result.applied).toBe(true);
    expect((result.projection?.technical as Record<string, unknown>).kelvin).toBe(3500);
    expect(result.projection?.sourceVersion).toBe(11);
    expect(result.triggers).toContain('search-reindex');
    expect(result.triggers).toContain('media-document-refresh');
  });

  it('withdraw event forces visibility off', () => {
    const current = {
      productId: 'p-1',
      sku: 'SKU-001',
      erpProductId: 'erp-1',
      sourceVersion: 3,
      projectionVersion: 1,
      lifecycleState: 'published' as const,
      visibility: { retail: true, b2b: true },
      technical: {},
      media: { primaryImage: null, gallery: [] },
      documents: {
        datasheets: [],
        certificates: [],
        installation: [],
        warranty: [],
        compliance: [],
      },
    };
    const event = {
      eventType: 'catalog.product.withdraw',
      source: { sourceVersion: 4 },
      payload: {},
    };

    const result = applyPublicationEvent(current, event);

    expect(result.applied).toBe(true);
    expect(result.projection?.lifecycleState).toBe('withdrawn');
    expect(result.projection?.visibility).toEqual({ retail: false, b2b: false });
  });

  it('deriveTriggers defaults to search reindex when changed paths missing', () => {
    expect(deriveTriggers([])).toEqual(['search-reindex']);
  });

  it('full upsert replaces projection entirely and sets sourceVersion', () => {
    const current = {
      productId: 'p-1',
      sku: 'SKU-001',
      erpProductId: 'erp-1',
      sourceVersion: 5,
      projectionVersion: 1,
      lifecycleState: 'published' as const,
      visibility: { retail: true, b2b: true },
      technical: { lumens: 500 },
      media: { primaryImage: null, gallery: [] },
      documents: {
        datasheets: [],
        certificates: [],
        installation: [],
        warranty: [],
        compliance: [],
      },
    };
    const event = {
      eventType: 'catalog.product.upsert-full',
      source: { sourceVersion: 6 },
      payload: {
        productId: 'p-1',
        sku: 'SKU-002',
        technical: { lumens: 900, kelvin: 4000 },
      },
    };

    const result = applyPublicationEvent(current, event);

    expect(result.applied).toBe(true);
    expect(result.reason).toBe('full-upsert');
    expect(result.projection?.sourceVersion).toBe(6);
    // Full replace: new SKU from payload, NOT merged from current
    expect(result.projection?.sku).toBe('SKU-002');
    // Old lumens are gone — full replace, not merge
    expect((result.projection?.technical as Record<string, unknown>).lumens).toBe(900);
    // kelvin from full payload, not inherited from old projection
    expect((result.projection?.technical as Record<string, unknown>).kelvin).toBe(4000);
  });

  it('deepMerge overwrites arrays (does not append)', () => {
    const base = { gallery: [{ url: 'https://cdn.example.com/a.jpg' }] };
    const patch = { gallery: [{ url: 'https://cdn.example.com/b.jpg' }] };

    const merged = deepMerge(
      base as Record<string, unknown>,
      patch as Record<string, unknown>,
    );

    const gallery = merged.gallery as Array<{ url: string }>;
    expect(gallery).toHaveLength(1);
    expect(gallery[0].url).toBe('https://cdn.example.com/b.jpg');
  });

  it('throws on invalid event (missing eventType)', () => {
    expect(() =>
      applyPublicationEvent(null, { eventType: '', source: { sourceVersion: 1 }, payload: {} }),
    ).toThrow('Invalid publication event');
  });

  it('throws on unsupported eventType', () => {
    expect(() =>
      applyPublicationEvent(null, {
        eventType: 'catalog.product.unknown',
        source: { sourceVersion: 1 },
        payload: {},
      }),
    ).toThrow('Unsupported event type');
  });

  it('publication contract schema contains required domain fields', () => {
    const schemaPath = path.join(
      __dirname,
      '..',
      '..',
      'contracts',
      'catalog-publication-event-v1.schema.json',
    );
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as {
      properties: {
        payload: {
          properties: {
            visibility: unknown;
            media: unknown;
            documents: unknown;
            technical: {
              properties: Record<string, unknown>;
            };
          };
        };
      };
    };
    const payload = schema.properties.payload.properties;
    const technical = payload.technical.properties;

    expect(payload.visibility).toBeTruthy();
    expect(payload.media).toBeTruthy();
    expect(payload.documents).toBeTruthy();
    expect(technical.lumens).toBeTruthy();
    expect(technical.kelvin).toBeTruthy();
    expect(technical.cri).toBeTruthy();
    expect(technical.ipRating).toBeTruthy();
    expect(technical.wattage).toBeTruthy();
    expect(technical.voltage).toBeTruthy();
    expect(technical.mountingType).toBeTruthy();
    expect(technical.dimensions).toBeTruthy();
    expect(technical.ean).toBeTruthy();
    expect(technical.supplierCodes).toBeTruthy();
    expect(technical.manufacturerCodes).toBeTruthy();
    expect(technical.complianceFlags).toBeTruthy();
  });
});
