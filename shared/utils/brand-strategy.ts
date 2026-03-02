export interface BrandStrategy {
  brandName: string;
  website: string;
  promise: string;
  seo: {
    metaDescriptionCta: string;
  };
}

const DEFAULT_BRAND_STRATEGY: BrandStrategy = {
  brandName: 'Ledux',
  website: 'https://ledux.ro',
  promise: 'Iluminat profesional pentru proiecte rezidentiale si comerciale.',
  seo: {
    metaDescriptionCta: 'Comanda online cu livrare rapida din stoc.',
  },
};

export function loadBrandStrategySync(): BrandStrategy {
  return DEFAULT_BRAND_STRATEGY;
}
