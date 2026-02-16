/**
 * Video Script Template Service
 * Pre-built TikTok video script templates for product marketing.
 * 
 * Strategy: Organic content focused on visual / economic benefits (no media budget).
 * Audio: Deep House / Minimal Techno + ASMR sounds.
 */

import { createModuleLogger } from '@shared/utils/logger';
import { VideoScript, VideoFrame } from '../dtos/VideoScript';

const logger = createModuleLogger('video-script-templates');

export interface ProductInfo {
    name: string;
    category: string;
    keyBenefit: string;
    energySavings?: string;
    energyClass?: string;
    price?: number;
}

export class VideoScriptTemplateService {

    /**
     * Get the "Iluminatul Magnetic" script template.
     * Exact specification from requirements.
     */
    getIluminatulMagneticScript(): VideoScript {
        return {
            title: 'Iluminatul Magnetic',
            totalDurationSec: 20,
            audioStyle: 'Deep House / Minimal Techno + Sunete ASMR (click-uri metalice)',
            productCategory: 'lighting',
            hashtags: [
                '#IluminatMagnetic', '#SmartLighting', '#PremiumLED',
                '#InteriorDesign', '#HomeDecor', '#LEDLighting',
                '#EnergyEfficient', '#ModernHome', '#SmartHome',
            ],
            frames: [
                {
                    startSec: 0,
                    endSec: 3,
                    type: 'hook',
                    copyText: 'Uită de fire.',
                    audioNote: 'Deep House beat drop + Sunet puternic de CLICK magnetic (ASMR)',
                    visualDescription: 'Cadru macro. Mâna apropie spotul de șină. Sunet puternic de CLICK magnetic. Focus pe momentul de atașare magnetică.',
                },
                {
                    startSec: 3,
                    endSec: 8,
                    type: 'demo',
                    copyText: 'Configurează lumina instant.',
                    audioNote: 'Beat crescendo + click-uri rapide metalice',
                    visualDescription: 'Montaj rapid (Speed-ramp). Mutarea a 3 spoturi diferite pe șină în 5 secunde. Tranziții fluide între configurații.',
                },
                {
                    startSec: 8,
                    endSec: 13,
                    type: 'benefit',
                    copyText: 'Premium LED. Clasa A++.',
                    audioNote: 'Melodie ambient, ton cald',
                    visualDescription: 'Cadru larg living. Lumina se schimbă din Rece -> Cald. Atmosferă premium, mobilier modern.',
                },
                {
                    startSec: 13,
                    endSec: 17,
                    type: 'economy',
                    copyText: 'Facturi cu 70% mai mici.',
                    audioNote: 'Sound effect: cash register / coin drop satisfying',
                    visualDescription: 'Grafic suprapus pe video: O factură animată care scade vizual. Numere care se micșorează rapid.',
                },
                {
                    startSec: 17,
                    endSec: 20,
                    type: 'cta',
                    copyText: 'Link în Bio.',
                    audioNote: 'Beat final, fade out',
                    visualDescription: 'Produsul final pe fundal premium. Logo. Link indicator animat.',
                },
            ],
        };
    }

    /**
     * Generate a product-specific script using a template pattern.
     * Adapts the "Iluminatul Magnetic" structure to any product.
     */
    generateProductScript(product: ProductInfo, templateName: string = 'magnetic'): VideoScript {
        logger.info('Generating product script', { product: product.name, template: templateName });

        const baseScript = this.getIluminatulMagneticScript();

        // Adapt the template to the specific product
        const adaptedFrames: VideoFrame[] = [
            {
                startSec: 0,
                endSec: 3,
                type: 'hook',
                copyText: this.generateHook(product),
                audioNote: baseScript.frames[0].audioNote,
                visualDescription: `Cadru macro pe ${product.name}. Moment de interacțiune satisfying.`,
            },
            {
                startSec: 3,
                endSec: 8,
                type: 'demo',
                copyText: `Descoperă ${product.name}.`,
                audioNote: baseScript.frames[1].audioNote,
                visualDescription: `Montaj rapid demonstrând ${product.keyBenefit}. Speed-ramp transitions.`,
            },
            {
                startSec: 8,
                endSec: 13,
                type: 'benefit',
                copyText: product.keyBenefit,
                audioNote: baseScript.frames[2].audioNote,
                visualDescription: `Cadru larg arătând produsul în context real. Atmosferă premium.`,
            },
            {
                startSec: 13,
                endSec: 17,
                type: 'economy',
                copyText: product.energySavings ?? 'Economia care contează.',
                audioNote: baseScript.frames[3].audioNote,
                visualDescription: 'Grafic animat cu economii / beneficii financiare.',
            },
            {
                startSec: 17,
                endSec: 20,
                type: 'cta',
                copyText: 'Link în Bio.',
                audioNote: baseScript.frames[4].audioNote,
                visualDescription: 'Produsul final pe fundal premium. Logo. Link indicator.',
            },
        ];

        return {
            title: `${product.name} - ${product.category}`,
            totalDurationSec: 20,
            audioStyle: baseScript.audioStyle,
            productCategory: product.category,
            hashtags: this.generateHashtags(product),
            frames: adaptedFrames,
        };
    }

    /**
     * Get all available template names.
     */
    getAvailableTemplates(): string[] {
        return ['magnetic', 'product_showcase', 'comparison', 'unboxing'];
    }

    /**
     * Generate a compelling hook based on product category.
     */
    private generateHook(product: ProductInfo): string {
        const hooks: Record<string, string> = {
            lighting: 'Uită de fire.',
            furniture: 'Design fără compromis.',
            electronics: 'Tehnologie premium.',
            home: 'Casa ta, reinventată.',
            default: `Descoperă ${product.name}.`,
        };

        return hooks[product.category] ?? hooks.default;
    }

    /**
     * Generate relevant hashtags for a product.
     */
    private generateHashtags(product: ProductInfo): string[] {
        const base = ['#PremiumQuality', '#SmartBuy', '#MadeInEurope'];
        const categoryTags: Record<string, string[]> = {
            lighting: ['#LEDLighting', '#SmartLighting', '#InteriorDesign'],
            furniture: ['#ModernFurniture', '#InteriorDesign', '#HomeDecor'],
            electronics: ['#TechReview', '#SmartHome', '#GadgetReview'],
            home: ['#HomeDecor', '#HomeMakeover', '#InteriorDesign'],
        };

        return [...base, ...(categoryTags[product.category] ?? [])];
    }
}
