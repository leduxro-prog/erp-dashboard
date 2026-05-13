type BrandDirection = 'technical_premium' | 'warm_residential' | 'hybrid_commerce';

export interface BrandStrategySettings {
  brandName: string;
  website: string;
  selectedDirection: BrandDirection;
  promise: string;
  positioning: string;
  tone: string[];
  seo: {
    titleSuffix: string;
    metaDescriptionCta: string;
  };
}

const DEFAULT_DIRECTION: BrandDirection = 'hybrid_commerce';

const DIRECTION_DETAILS: Record<
  BrandDirection,
  Pick<BrandStrategySettings, 'promise' | 'positioning' | 'tone' | 'seo'>
> = {
  technical_premium: {
    promise: 'Solutii LED profesionale, alese pentru performanta si fiabilitate.',
    positioning: 'Expert tehnic pentru proiecte de iluminat premium.',
    tone: ['precis', 'consultativ', 'profesionist'],
    seo: {
      titleSuffix: 'Ledux.ro - iluminat LED profesional',
      metaDescriptionCta: 'Cere oferta si verifica disponibilitatea produselor LED profesionale.',
    },
  },
  warm_residential: {
    promise: 'Iluminat LED confortabil pentru case primitoare si eficiente.',
    positioning: 'Partener pentru amenajari rezidentiale calde si moderne.',
    tone: ['cald', 'clar', 'inspirational'],
    seo: {
      titleSuffix: 'Ledux.ro - iluminat LED pentru casa',
      metaDescriptionCta: 'Alege solutii LED potrivite pentru casa ta.',
    },
  },
  hybrid_commerce: {
    promise: 'Solutii LED disponibile rapid pentru proiecte rezidentiale si comerciale.',
    positioning: 'Magazin B2B/B2C pentru iluminat LED cu stoc si consultanta.',
    tone: ['clar', 'comercial', 'de incredere'],
    seo: {
      titleSuffix: 'Ledux.ro - solutii LED in stoc',
      metaDescriptionCta: 'Comanda online sau cere suport pentru alegerea produselor LED potrivite.',
    },
  },
};

function normalizeWebsite(website: string): string {
  return website.trim().replace(/\/$/, '') || 'https://ledux.ro';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asDirection(value: unknown): BrandDirection {
  return value === 'technical_premium' || value === 'warm_residential' || value === 'hybrid_commerce'
    ? value
    : DEFAULT_DIRECTION;
}

export function getDefaultBrandStrategy(
  brandName = 'Ledux',
  website = 'https://ledux.ro',
): BrandStrategySettings {
  const direction = DEFAULT_DIRECTION;
  const details = DIRECTION_DETAILS[direction];

  return {
    brandName: brandName.trim() || 'Ledux',
    website: normalizeWebsite(website),
    selectedDirection: direction,
    promise: details.promise,
    positioning: details.positioning,
    tone: [...details.tone],
    seo: { ...details.seo },
  };
}

export function resolveBrandStrategyFromSettings(settings?: unknown): BrandStrategySettings {
  const source = isRecord(settings) && isRecord(settings.brandStrategy) ? settings.brandStrategy : {};
  const selectedDirection = asDirection(source.selectedDirection);
  const directionDefaults = DIRECTION_DETAILS[selectedDirection];
  const base = getDefaultBrandStrategy();
  const seo = isRecord(source.seo) ? source.seo : {};

  return {
    brandName: asString(source.brandName, base.brandName),
    website: normalizeWebsite(asString(source.website, base.website)),
    selectedDirection,
    promise: asString(source.promise, directionDefaults.promise),
    positioning: asString(source.positioning, directionDefaults.positioning),
    tone: Array.isArray(source.tone)
      ? source.tone.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      : [...directionDefaults.tone],
    seo: {
      titleSuffix: asString(seo.titleSuffix, directionDefaults.seo.titleSuffix),
      metaDescriptionCta: asString(
        seo.metaDescriptionCta,
        directionDefaults.seo.metaDescriptionCta,
      ),
    },
  };
}

export function getBrandVisualShortlist(strategy?: BrandStrategySettings) {
  const selectedDirection = strategy?.selectedDirection || DEFAULT_DIRECTION;

  return [
    {
      id: 'technical_premium' as const,
      name: 'Technical Premium',
      description: 'Precizie tehnica, incredere B2B si executie premium.',
      selected: selectedDirection === 'technical_premium',
    },
    {
      id: 'warm_residential' as const,
      name: 'Warm Residential',
      description: 'Ton cald pentru clienti rezidentiali si amenajari interioare.',
      selected: selectedDirection === 'warm_residential',
    },
    {
      id: 'hybrid_commerce' as const,
      name: 'Hybrid Commerce',
      description: 'Echilibru intre catalog comercial, stoc si consultanta tehnica.',
      selected: selectedDirection === 'hybrid_commerce',
    },
  ];
}

export function loadBrandStrategySync(): BrandStrategySettings {
  return getDefaultBrandStrategy();
}
