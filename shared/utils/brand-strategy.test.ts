import {
  getBrandVisualShortlist,
  getDefaultBrandStrategy,
  loadBrandStrategySync,
  resolveBrandStrategyFromSettings,
} from './brand-strategy';

describe('brand strategy utility', () => {
  it('provides deterministic defaults used by settings and SEO', () => {
    const strategy = getDefaultBrandStrategy('LEDUX', 'https://ledux.ro/');

    expect(strategy.brandName).toBe('LEDUX');
    expect(strategy.website).toBe('https://ledux.ro');
    expect(strategy.selectedDirection).toBe('hybrid_commerce');
    expect(strategy.promise).toBeTruthy();
    expect(strategy.seo.titleSuffix).toBeTruthy();
    expect(strategy.seo.metaDescriptionCta).toBeTruthy();
  });

  it('resolves partial settings without dropping required SEO fields', () => {
    const strategy = resolveBrandStrategyFromSettings({
      brandStrategy: {
        selectedDirection: 'technical_premium',
        brandName: 'Custom',
        seo: {
          titleSuffix: 'Custom.ro',
        },
      },
    });

    expect(strategy.brandName).toBe('Custom');
    expect(strategy.selectedDirection).toBe('technical_premium');
    expect(strategy.seo.titleSuffix).toBe('Custom.ro');
    expect(strategy.seo.metaDescriptionCta).toBeTruthy();
  });

  it('returns static visual shortlist and sync strategy without I/O', () => {
    const shortlist = getBrandVisualShortlist();
    const strategy = loadBrandStrategySync();

    expect(shortlist.map((item) => item.id)).toEqual([
      'technical_premium',
      'warm_residential',
      'hybrid_commerce',
    ]);
    expect(strategy.website).toBe('https://ledux.ro');
  });
});
