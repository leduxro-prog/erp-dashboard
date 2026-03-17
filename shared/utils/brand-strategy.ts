import fs from 'fs';
import path from 'path';

export type BrandDirection = 'technical_premium' | 'warm_residential' | 'hybrid_commerce';

export interface BrandStrategySettings {
  selectedDirection: BrandDirection;
  brandName: string;
  website: string;
  promise: string;
  toneOfVoice?: string[];
  valuePillars?: string[];
  forbiddenPhrases?: string[];
  seo: {
    titleSuffix: string;
    metaDescriptionCta: string;
    focusKeywords?: string[];
    categoryIntentMap?: Record<string, string>;
  };
  ai?: {
    enforceBrandGuardrails?: boolean;
    defaultTemperature?: number;
    maxTokens?: number;
    preferredModel?: string;
  };
}

export function getDefaultBrandStrategy(
  brandName = 'LEDUX',
  website = 'https://ledux.ro',
): BrandStrategySettings {
  return {
    selectedDirection: 'hybrid_commerce',
    brandName,
    website,
    promise: 'Solutii profesionale de iluminat pentru proiecte premium.',
    toneOfVoice: ['clar', 'aplicat', 'prietenos'],
    valuePillars: ['expertiza tehnica', 'stoc real', 'livrare rapida'],
    forbiddenPhrases: ['cel mai ieftin garantat', 'promisiuni absolute'],
    seo: {
      titleSuffix: ` | ${brandName}`,
      metaDescriptionCta: 'Descopera gama completa si cere oferta personalizata.',
      focusKeywords: ['iluminat led', 'corpuri iluminat'],
      categoryIntentMap: {},
    },
    ai: {
      enforceBrandGuardrails: true,
      defaultTemperature: 0.2,
      maxTokens: 900,
      preferredModel: 'gemini-2.5-flash',
    },
  };
}

export function resolveBrandStrategyFromSettings(
  settings: Record<string, unknown>,
): BrandStrategySettings {
  const defaults = getDefaultBrandStrategy(
    String(settings.companyName || 'LEDUX'),
    String(settings.website || 'https://ledux.ro'),
  );

  const raw = (settings.brandStrategy || {}) as Record<string, unknown>;
  const rawSeo = (raw.seo || {}) as Record<string, unknown>;

  const selectedDirection =
    raw.selectedDirection === 'technical_premium' ||
    raw.selectedDirection === 'warm_residential' ||
    raw.selectedDirection === 'hybrid_commerce'
      ? raw.selectedDirection
      : defaults.selectedDirection;

  return {
    selectedDirection,
    brandName: String(raw.brandName || defaults.brandName),
    website: String(raw.website || defaults.website),
    promise: String(raw.promise || defaults.promise),
    toneOfVoice: Array.isArray(raw.toneOfVoice)
      ? raw.toneOfVoice.map((value) => String(value))
      : defaults.toneOfVoice,
    valuePillars: Array.isArray(raw.valuePillars)
      ? raw.valuePillars.map((value) => String(value))
      : defaults.valuePillars,
    forbiddenPhrases: Array.isArray(raw.forbiddenPhrases)
      ? raw.forbiddenPhrases.map((value) => String(value))
      : defaults.forbiddenPhrases,
    seo: {
      titleSuffix: String(rawSeo.titleSuffix || defaults.seo.titleSuffix),
      metaDescriptionCta: String(rawSeo.metaDescriptionCta || defaults.seo.metaDescriptionCta),
      focusKeywords: Array.isArray(rawSeo.focusKeywords)
        ? rawSeo.focusKeywords.map((value) => String(value))
        : defaults.seo.focusKeywords,
      categoryIntentMap:
        rawSeo.categoryIntentMap && typeof rawSeo.categoryIntentMap === 'object'
          ? Object.fromEntries(
              Object.entries(rawSeo.categoryIntentMap as Record<string, unknown>).map(
                ([key, value]) => [String(key), String(value)],
              ),
            )
          : defaults.seo.categoryIntentMap,
    },
    ai:
      raw.ai && typeof raw.ai === 'object'
        ? {
            enforceBrandGuardrails: Boolean(
              (raw.ai as Record<string, unknown>).enforceBrandGuardrails ??
                defaults.ai?.enforceBrandGuardrails,
            ),
            defaultTemperature: Number(
              (raw.ai as Record<string, unknown>).defaultTemperature ??
                defaults.ai?.defaultTemperature,
            ),
            maxTokens: Number(
              (raw.ai as Record<string, unknown>).maxTokens ?? defaults.ai?.maxTokens,
            ),
            preferredModel: String(
              (raw.ai as Record<string, unknown>).preferredModel ?? defaults.ai?.preferredModel,
            ),
          }
        : defaults.ai,
  };
}

export function getBrandVisualShortlist(): Array<{
  id: BrandDirection;
  label: string;
  description: string;
}> {
  return [
    {
      id: 'technical_premium',
      label: 'Technical Premium',
      description: 'Accent pe specificatii tehnice, incredere si executie premium.',
    },
    {
      id: 'warm_residential',
      label: 'Warm Residential',
      description: 'Comunicare calda, orientata spre confort si ambient rezidential.',
    },
    {
      id: 'hybrid_commerce',
      label: 'Hybrid Commerce',
      description: 'Echilibru intre claritate comerciala, viteza si recomandare tehnica.',
    },
  ];
}

export function loadBrandStrategySync(configFilePath?: string): BrandStrategySettings {
  const settingsPath = configFilePath || path.join(process.cwd(), 'config', 'settings.json');

  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return resolveBrandStrategyFromSettings(parsed);
  } catch {
    return getDefaultBrandStrategy();
  }
}
