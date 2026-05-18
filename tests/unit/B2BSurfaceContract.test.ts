import * as fs from 'fs';
import * as path from 'path';

import { describe, it, expect } from '@jest/globals';

describe('B2BSurfaceContract', () => {
  const schemaPath = path.join(__dirname, '../../contracts/b2b-surface-contract-v1.schema.json');

  it('b2b contract encodes first-class in-platform governed model', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    expect(schema.properties.surfaceType.const).toBe('in-platform-first-class');
    expect(schema.required).toContain('ownership');
    expect(schema.required).toContain('releasePath');
    expect(schema.required).toContain('authentication');
    expect(schema.required).toContain('pricing');
    expect(schema.required).toContain('visibility');
    expect(schema.required).toContain('quoteProjectFlow');
  });

  it('b2b contract requires independent gate and retail separation semantics', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    const releaseProps = schema.properties.releasePath.properties;
    const visibilityProps = schema.properties.visibility.properties;
    expect(releaseProps.independentB2BGate).toBeDefined();
    expect(releaseProps.requiresCommerceCompatibilityCheck).toBeDefined();
    expect(visibilityProps.separateFromRetail).toBeDefined();
    expect(visibilityProps.usesPublishedCatalogVisibility).toBeDefined();
  });

  it('b2b contract ownership block includes erp, commerceCore, and b2bSurface', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

    const ownership = schema.properties.ownership;
    expect(ownership.required).toHaveLength(3);
    expect(ownership.required).toContain('erp');
    expect(ownership.required).toContain('commerceCore');
    expect(ownership.required).toContain('b2bSurface');

    expect(ownership.properties.erp).toBeDefined();
    expect(ownership.properties.commerceCore).toBeDefined();
    expect(ownership.properties.b2bSurface).toBeDefined();
    expect(ownership.additionalProperties).toBe(false);
  });
});
