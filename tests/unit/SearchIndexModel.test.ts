import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from '@jest/globals';

import {
  AliasAction,
  buildAliasSwapPlan,
  buildGenerationIndexName,
  buildRollbackPlan,
} from '../../src/search/reindex-plan';

function readJson(file: string): Record<string, unknown> {
  const full = path.join(__dirname, '..', '..', file);
  return JSON.parse(fs.readFileSync(full, 'utf8')) as Record<string, unknown>;
}

describe('SearchIndexModel', () => {
  it('search mapping contains mandatory technical and visibility fields', () => {
    const mapping = readJson('contracts/search-index-product-v1.opensearch.json');
    const props = (mapping.mappings as { properties: Record<string, unknown> }).properties;
    const technical = props.technical as { properties: Record<string, unknown> };
    const visibility = props.visibility as { properties: Record<string, unknown> };

    expect(props.categoryTree).toBeTruthy();
    expect(props.brand).toBeTruthy();
    expect(props.manufacturer).toBeTruthy();
    expect(technical.properties.lumens).toBeTruthy();
    expect(technical.properties.kelvin).toBeTruthy();
    expect(technical.properties.cri).toBeTruthy();
    expect(technical.properties.ipRating).toBeTruthy();
    expect(technical.properties.wattage).toBeTruthy();
    expect(technical.properties.voltage).toBeTruthy();
    expect(technical.properties.mountingType).toBeTruthy();
    expect(technical.properties.dimensions).toBeTruthy();
    expect(props.ean).toBeTruthy();
    expect(props.supplierCodes).toBeTruthy();
    expect(props.manufacturerCodes).toBeTruthy();
    expect(props.complianceFlags).toBeTruthy();
    expect(visibility.properties.retail).toBeTruthy();
    expect(visibility.properties.b2b).toBeTruthy();
  });

  it('search mapping includes media and documents references', () => {
    const mapping = readJson('contracts/search-index-product-v1.opensearch.json');
    const props = (mapping.mappings as { properties: Record<string, unknown> }).properties;
    const media = props.media as { properties: Record<string, unknown> };
    const documents = props.documents as { properties: Record<string, unknown> };

    expect(media.properties.primaryImageUrl).toBeTruthy();
    expect(media.properties.galleryUrls).toBeTruthy();
    expect(documents.properties.datasheets).toBeTruthy();
    expect(documents.properties.certificates).toBeTruthy();
    expect(documents.properties.installation).toBeTruthy();
    expect(documents.properties.warranty).toBeTruthy();
    expect(documents.properties.compliance).toBeTruthy();
  });

  it('alias swap plan builds deterministic actions', () => {
    const plan = buildAliasSwapPlan({
      aliasRead: 'catalog_products_read',
      aliasWrite: 'catalog_products_write',
      oldIndex: 'catalog_products_v202603141010',
      newIndex: 'catalog_products_v202603141215',
    });

    expect(plan.actions).toHaveLength(4);
    expect(plan.actions[0]).toEqual({
      remove: { index: 'catalog_products_v202603141010', alias: 'catalog_products_read' },
    });
    expect(plan.actions[1]).toEqual({
      remove: { index: 'catalog_products_v202603141010', alias: 'catalog_products_write' },
    });
    expect(plan.actions[2]).toEqual({
      add: { index: 'catalog_products_v202603141215', alias: 'catalog_products_read' },
    });
    expect(plan.actions[3]).toEqual({
      add: { index: 'catalog_products_v202603141215', alias: 'catalog_products_write' },
    });
  });

  it('rollback plan points read alias back to previous index', () => {
    const plan = buildRollbackPlan({
      aliasRead: 'catalog_products_read',
      currentIndex: 'catalog_products_v202603141215',
      previousIndex: 'catalog_products_v202603141010',
    });

    expect(plan.actions).toHaveLength(2);
    expect(plan.actions[1]).toEqual({
      add: { index: 'catalog_products_v202603141010', alias: 'catalog_products_read' },
    });
  });

  it('generation index naming is versioned and stable format', () => {
    const name = buildGenerationIndexName('catalog_products', new Date('2026-03-14T12:34:56Z'));
    expect(name).toBe('catalog_products_v202603141234');
  });

  it('buildAliasSwapPlan throws when required params are missing', () => {
    expect(() =>
      buildAliasSwapPlan({
        aliasRead: '',
        aliasWrite: 'catalog_products_write',
        newIndex: 'catalog_products_v202603141215',
      }),
    ).toThrow('aliasRead, aliasWrite and newIndex are required');

    expect(() =>
      buildAliasSwapPlan({
        aliasRead: 'catalog_products_read',
        aliasWrite: '',
        newIndex: 'catalog_products_v202603141215',
      }),
    ).toThrow('aliasRead, aliasWrite and newIndex are required');

    expect(() =>
      buildAliasSwapPlan({
        aliasRead: 'catalog_products_read',
        aliasWrite: 'catalog_products_write',
        newIndex: '',
      }),
    ).toThrow('aliasRead, aliasWrite and newIndex are required');
  });

  it('buildRollbackPlan throws when required params are missing', () => {
    expect(() =>
      buildRollbackPlan({
        aliasRead: '',
        currentIndex: 'catalog_products_v202603141215',
        previousIndex: 'catalog_products_v202603141010',
      }),
    ).toThrow('aliasRead, currentIndex and previousIndex are required');

    expect(() =>
      buildRollbackPlan({
        aliasRead: 'catalog_products_read',
        currentIndex: '',
        previousIndex: 'catalog_products_v202603141010',
      }),
    ).toThrow('aliasRead, currentIndex and previousIndex are required');

    expect(() =>
      buildRollbackPlan({
        aliasRead: 'catalog_products_read',
        currentIndex: 'catalog_products_v202603141215',
        previousIndex: '',
      }),
    ).toThrow('aliasRead, currentIndex and previousIndex are required');
  });

  it('alias swap plan without oldIndex omits remove action', () => {
    const plan = buildAliasSwapPlan({
      aliasRead: 'catalog_products_read',
      aliasWrite: 'catalog_products_write',
      newIndex: 'catalog_products_v202603141215',
    });

    expect(plan.actions).toHaveLength(2);
    expect(plan.actions.every((a: AliasAction) => a.remove === undefined)).toBe(true);
    expect(plan.actions[0]).toEqual({
      add: { index: 'catalog_products_v202603141215', alias: 'catalog_products_read' },
    });
    expect(plan.actions[1]).toEqual({
      add: { index: 'catalog_products_v202603141215', alias: 'catalog_products_write' },
    });
  });
});
