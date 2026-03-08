import { DataSource } from 'typeorm';
import { EnqueueSeoDrafts, SeoDraftItemInput } from '../../application/use-cases/EnqueueSeoDrafts';
import {
  SeoEligibilityFingerprintService,
  SeoFingerprintInput,
} from '../../domain/services/SeoEligibilityFingerprintService';

export const SEO_QUEUE_AUTORUN_FEATURE_FLAG = 'seo_auto_queue_autorun';
export const SEO_QUEUE_AUTORUN_CONFIG_KEY = 'SEO_QUEUE_AUTORUN_ENABLED';
export const SEO_QUEUE_CATCHUP_INTERVAL_MS_CONFIG_KEY = 'SEO_QUEUE_CATCHUP_INTERVAL_MS';
export const SEO_QUEUE_CATCHUP_BATCH_SIZE_CONFIG_KEY = 'SEO_QUEUE_CATCHUP_BATCH_SIZE';

const DEFAULT_CATCHUP_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_CATCHUP_BATCH_SIZE = 100;
const DEFAULT_LOCALE = 'ro';

interface QueueCandidate {
  productId: number;
  locale: string;
  seo: SeoFingerprintInput;
  lastAppliedFingerprint?: string | null;
  source: 'event' | 'scheduler';
}

type CatchUpRow = {
  entity_id: string | number;
  locale: string;
  meta_title: string | null;
  meta_description: string | null;
  slug: string | null;
  focus_keyword: string | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  last_fingerprint: string | null;
};

export interface SeoQueueAutoTriggerJobOptions {
  dataSource: DataSource;
  enqueueSeoDrafts: Pick<EnqueueSeoDrafts, 'execute'>;
  enabled: boolean;
  intervalMs?: number;
  batchSize?: number;
  defaultLocale?: string;
}

export class SeoQueueAutoTriggerJob {
  private readonly fingerprintService = new SeoEligibilityFingerprintService();
  private readonly intervalMs: number;
  private readonly batchSize: number;
  private readonly defaultLocale: string;
  private timer?: NodeJS.Timeout;
  private isCatchUpRunning = false;

  constructor(private readonly options: SeoQueueAutoTriggerJobOptions) {
    this.intervalMs = options.intervalMs ?? DEFAULT_CATCHUP_INTERVAL_MS;
    this.batchSize = options.batchSize ?? DEFAULT_CATCHUP_BATCH_SIZE;
    this.defaultLocale = options.defaultLocale ?? DEFAULT_LOCALE;
  }

  async start(): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    await this.runCatchUp();

    this.timer = setInterval(() => {
      this.runCatchUp().catch((error) => {
        this.logError('Periodic SEO queue catch-up failed', error);
      });
    }, this.intervalMs);

    this.timer.unref();
  }

  async stop(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  async handleProductEvent(eventData: unknown): Promise<void> {
    if (!this.options.enabled) {
      return;
    }

    const candidate = this.extractCandidateFromEvent(eventData);
    if (!candidate) {
      return;
    }

    await this.enqueueCandidate(candidate);
  }

  async runCatchUp(): Promise<void> {
    if (!this.options.enabled || this.isCatchUpRunning) {
      return;
    }

    this.isCatchUpRunning = true;
    try {
      const rows = (await this.options.dataSource.query(
        `
          SELECT
            m.entity_id,
            m.locale,
            m.meta_title,
            m.meta_description,
            m.slug,
            m.focus_keyword,
            m.canonical_url,
            m.og_title,
            m.og_description,
            m.og_image,
            s.last_fingerprint
          FROM seo_metadata m
          LEFT JOIN seo_product_state s
            ON s.product_id = CAST(m.entity_id AS BIGINT)
            AND s.locale = m.locale
          WHERE m.entity_type = 'PRODUCT'
          ORDER BY m.updated_at DESC
          LIMIT $1
        `,
        [this.batchSize],
      )) as CatchUpRow[];

      for (const row of rows) {
        const productId = Number(row.entity_id);
        if (!Number.isFinite(productId) || productId <= 0) {
          continue;
        }

        await this.enqueueCandidate({
          productId,
          locale: this.normalizeString(row.locale) || this.defaultLocale,
          seo: {
            metaTitle: row.meta_title ?? undefined,
            metaDescription: row.meta_description ?? undefined,
            slug: row.slug ?? undefined,
            focusKeyword: row.focus_keyword ?? undefined,
            canonicalUrl: row.canonical_url ?? undefined,
            ogTitle: row.og_title ?? undefined,
            ogDescription: row.og_description ?? undefined,
            ogImage: row.og_image ?? undefined,
          },
          lastAppliedFingerprint: row.last_fingerprint,
          source: 'scheduler',
        });
      }
    } catch (error) {
      this.logError('SEO queue catch-up run failed', error);
      throw error;
    } finally {
      this.isCatchUpRunning = false;
    }
  }

  private logError(message: string, error: unknown): void {
    const details =
      error instanceof Error
        ? { message: error.message, stack: error.stack }
        : { message: String(error) };
    console.error('[seo-automation][queue-autotrigger]', message, details);
  }

  private extractCandidateFromEvent(eventData: unknown): QueueCandidate | null {
    if (!eventData || typeof eventData !== 'object') {
      return null;
    }

    const root = eventData as Record<string, unknown>;
    const payload =
      root.payload && typeof root.payload === 'object'
        ? (root.payload as Record<string, unknown>)
        : root;

    const rawProductId =
      payload.woo_product_id ?? payload.product_id ?? payload.id ?? root.product_id ?? root.source_entity_id;
    const productId = Number(rawProductId);
    if (!Number.isFinite(productId) || productId <= 0) {
      return null;
    }

    const locale =
      this.normalizeString(payload.locale) ||
      this.normalizeString(root.locale) ||
      this.normalizeString(payload.language_code) ||
      this.defaultLocale;

    const seo: SeoFingerprintInput = {
      metaTitle: this.normalizeString(payload.meta_title) || this.normalizeString(payload.metaTitle),
      metaDescription:
        this.normalizeDescription(payload.meta_description) ||
        this.normalizeDescription(payload.metaDescription),
      slug: this.normalizeString(payload.slug),
      focusKeyword: this.normalizeString(payload.focus_keyword) || this.normalizeString(payload.focusKeyword),
      canonicalUrl:
        this.normalizeString(payload.canonical_url) || this.normalizeString(payload.canonicalUrl),
      ogTitle: this.normalizeString(payload.og_title) || this.normalizeString(payload.ogTitle),
      ogDescription:
        this.normalizeDescription(payload.og_description) ||
        this.normalizeDescription(payload.ogDescription),
      ogImage: this.normalizeString(payload.og_image) || this.normalizeString(payload.ogImage),
    };

    if (!seo.metaTitle) {
      seo.metaTitle = this.normalizeString(payload.name);
    }

    if (!seo.metaDescription) {
      seo.metaDescription =
        this.normalizeDescription(payload.short_description) ||
        this.normalizeDescription(payload.description) ||
        undefined;
    }

    return {
      productId,
      locale,
      seo,
      source: 'event',
    };
  }

  private async enqueueCandidate(candidate: QueueCandidate): Promise<void> {
    const evaluation = this.fingerprintService.evaluate({
      seo: candidate.seo,
      lastAppliedFingerprint: candidate.lastAppliedFingerprint,
    });

    if (evaluation.status === 'MISSING' || evaluation.status === 'UNCHANGED' || !evaluation.fingerprint) {
      return;
    }

    const items = this.buildItems(candidate.seo);
    if (items.length === 0) {
      return;
    }

    await this.options.enqueueSeoDrafts.execute({
      productId: candidate.productId,
      locale: candidate.locale,
      fingerprint: evaluation.fingerprint,
      items,
      metadata: {
        source: candidate.source,
        trigger: 'seo_queue_autorun',
      },
    });
  }

  private buildItems(seo: SeoFingerprintInput): SeoDraftItemInput[] {
    const entries: Array<[string, string | undefined]> = [
      ['metaTitle', this.normalizeString(seo.metaTitle)],
      ['metaDescription', this.normalizeDescription(seo.metaDescription)],
      ['slug', this.normalizeString(seo.slug)],
      ['focusKeyword', this.normalizeString(seo.focusKeyword)],
      ['canonicalUrl', this.normalizeString(seo.canonicalUrl)],
      ['ogTitle', this.normalizeString(seo.ogTitle)],
      ['ogDescription', this.normalizeDescription(seo.ogDescription)],
      ['ogImage', this.normalizeString(seo.ogImage)],
    ];

    return entries
      .filter(([, value]) => Boolean(value))
      .map(([fieldName, proposedValue]) => ({
        fieldName,
        currentValue: null,
        proposedValue,
        isSelected: true,
      }));
  }

  private normalizeDescription(value: unknown): string {
    const normalized = this.normalizeString(value);
    if (!normalized) {
      return '';
    }

    return normalized.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
  }

  private normalizeString(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }
}

export type { SeoFingerprintInput };
