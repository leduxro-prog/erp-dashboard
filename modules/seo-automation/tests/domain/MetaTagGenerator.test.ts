import { describe, expect, it } from '@jest/globals';

import { MetaTagGenerator } from '../../src/domain/services/MetaTagGenerator';

describe('MetaTagGenerator', () => {
  it('uses injected brand SEO strategy for generated product tags', () => {
    const generator = new MetaTagGenerator({
      brandName: 'Custom Brand',
      titleSuffix: 'Custom.ro - strategie SEO',
      defaultCta: 'CTA configurat pentru descrieri SEO.',
    });

    const tags = generator.generateForProduct({
      name: 'Bec LED GU10',
      category: 'Becuri LED',
    });

    expect(tags.title).toBe('Bec LED GU10 - Becuri LED | Custom.ro - strategie SEO');
    expect(tags.description).toContain('CTA configurat pentru descrieri SEO.');
  });
});
