import { SeoDraftChangeset } from './EnqueueSeoDrafts';

const CANONICAL_FIELDS = new Set([
  'metaTitle',
  'metaDescription',
  'slug',
  'canonicalUrl',
  'ogTitle',
  'ogDescription',
  'ogImage',
  'twitterTitle',
  'twitterDescription',
  'focusKeyword',
]);

export interface ApplyApprovedSeoDraftsInput {
  productId?: number;
  locale?: string;
}

export interface ApplyApprovedSeoDraftsOutput {
  appliedCount: number;
}

export interface IApplyApprovedSeoDraftsTransactionRepository {
  findApprovedChangesets(filter: ApplyApprovedSeoDraftsInput): Promise<SeoDraftChangeset[]>;
  applyMetadataPatch(input: {
    productId: number;
    locale: string;
    patch: Record<string, string | null>;
  }): Promise<void>;
  updateProductStateFingerprint(input: {
    productId: number;
    locale: string;
    fingerprint: string;
    changesetId: number;
  }): Promise<void>;
  markChangesetApplied(input: { changesetId: number }): Promise<void>;
}

export interface IApplyApprovedSeoDraftsRepository {
  withTransaction<T>(
    run: (repository: IApplyApprovedSeoDraftsTransactionRepository) => Promise<T>,
  ): Promise<T>;
}

export class ApplyApprovedSeoDrafts {
  constructor(private readonly repository: IApplyApprovedSeoDraftsRepository) {}

  async execute(input: ApplyApprovedSeoDraftsInput): Promise<ApplyApprovedSeoDraftsOutput> {
    return this.repository.withTransaction(async (txRepository) => {
      const approvedChangesets = await txRepository.findApprovedChangesets(input);
      let appliedCount = 0;

      for (const changeset of approvedChangesets) {
        const patch = this.createCanonicalPatch(changeset);

        if (Object.keys(patch).length > 0) {
          await txRepository.applyMetadataPatch({
            productId: changeset.productId,
            locale: changeset.locale,
            patch,
          });
        }

        await txRepository.updateProductStateFingerprint({
          productId: changeset.productId,
          locale: changeset.locale,
          fingerprint: changeset.fingerprint,
          changesetId: changeset.id,
        });

        await txRepository.markChangesetApplied({ changesetId: changeset.id });
        appliedCount += 1;
      }

      return { appliedCount };
    });
  }

  private createCanonicalPatch(changeset: SeoDraftChangeset): Record<string, string | null> {
    const patch: Record<string, string | null> = {};

    for (const item of changeset.items) {
      if (!item.isSelected) {
        continue;
      }

      const normalizedField = this.normalizeFieldName(item.fieldName);
      if (!CANONICAL_FIELDS.has(normalizedField)) {
        continue;
      }

      patch[normalizedField] = item.proposedValue ?? null;
    }

    return patch;
  }

  private normalizeFieldName(fieldName: string): string {
    const map: Record<string, string> = {
      meta_title: 'metaTitle',
      meta_description: 'metaDescription',
      canonical_url: 'canonicalUrl',
      og_title: 'ogTitle',
      og_description: 'ogDescription',
      og_image: 'ogImage',
      twitter_title: 'twitterTitle',
      twitter_description: 'twitterDescription',
      focus_keyword: 'focusKeyword',
    };

    return map[fieldName] ?? fieldName;
  }
}
