import { createHash } from 'crypto';

export type SeoEligibilityStatus = 'NEW' | 'MISSING' | 'MODIFIED' | 'UNCHANGED';

export interface SeoFingerprintInput {
  metaTitle?: string;
  metaDescription?: string;
  slug?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

export interface SeoEligibilityEvaluationInput {
  seo: SeoFingerprintInput;
  lastAppliedFingerprint?: string | null;
}

export interface SeoEligibilityEvaluationResult {
  status: SeoEligibilityStatus;
  fingerprint: string | null;
  missingFields: Array<'metaTitle' | 'metaDescription' | 'slug'>;
}

const REQUIRED_FIELDS = ['metaTitle', 'metaDescription', 'slug'] as const;

export class SeoEligibilityFingerprintService {
  evaluate(input: SeoEligibilityEvaluationInput): SeoEligibilityEvaluationResult {
    const missingFields = REQUIRED_FIELDS.filter((field) => this.normalize(input.seo[field]) === '');

    if (missingFields.length > 0) {
      return {
        status: 'MISSING',
        fingerprint: null,
        missingFields: [...missingFields],
      };
    }

    const fingerprint = this.createFingerprint(input.seo);
    const lastAppliedFingerprint = input.lastAppliedFingerprint?.trim();

    if (!lastAppliedFingerprint) {
      return {
        status: 'NEW',
        fingerprint,
        missingFields: [],
      };
    }

    if (fingerprint !== lastAppliedFingerprint) {
      return {
        status: 'MODIFIED',
        fingerprint,
        missingFields: [],
      };
    }

    return {
      status: 'UNCHANGED',
      fingerprint,
      missingFields: [],
    };
  }

  createFingerprint(input: SeoFingerprintInput): string {
    const normalized = {
      metaTitle: this.normalize(input.metaTitle),
      metaDescription: this.normalize(input.metaDescription),
      slug: this.normalize(input.slug),
      focusKeyword: this.normalize(input.focusKeyword),
      canonicalUrl: this.normalize(input.canonicalUrl),
      ogTitle: this.normalize(input.ogTitle),
      ogDescription: this.normalize(input.ogDescription),
      ogImage: this.normalize(input.ogImage),
    };

    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  }

  private normalize(value: string | undefined): string {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  }
}
