export type SeoDraftChangesetStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface SeoDraftItemInput {
  fieldName: string;
  currentValue?: string | null;
  proposedValue?: string | null;
  aiConfidence?: number | null;
  reason?: string | null;
  isSelected?: boolean;
}

export interface SeoDraftItem {
  fieldName: string;
  currentValue?: string | null;
  proposedValue?: string | null;
  aiConfidence?: number | null;
  reason?: string | null;
  isSelected: boolean;
}

export interface SeoDraftChangeset {
  id: number;
  productId: number;
  locale: string;
  fingerprint: string;
  status: SeoDraftChangesetStatus;
  isActive: boolean;
  items: SeoDraftItem[];
}

export interface EnqueueSeoDraftsInput {
  productId: number;
  locale: string;
  fingerprint: string;
  createdBy?: number;
  items: SeoDraftItemInput[];
  metadata?: Record<string, unknown>;
}

export interface EnqueueSeoDraftsOutput {
  created: boolean;
  changeset: SeoDraftChangeset;
}

export interface IEnqueueSeoDraftsRepository {
  findActiveByFingerprint(input: {
    productId: number;
    locale: string;
    fingerprint: string;
  }): Promise<SeoDraftChangeset | null>;
  createChangeset(input: EnqueueSeoDraftsInput): Promise<SeoDraftChangeset>;
}

export class EnqueueSeoDrafts {
  constructor(private readonly repository: IEnqueueSeoDraftsRepository) {}

  async execute(input: EnqueueSeoDraftsInput): Promise<EnqueueSeoDraftsOutput> {
    const existing = await this.repository.findActiveByFingerprint({
      productId: input.productId,
      locale: input.locale,
      fingerprint: input.fingerprint,
    });

    if (existing) {
      return {
        created: false,
        changeset: existing,
      };
    }

    const created = await this.repository.createChangeset(input);
    return {
      created: true,
      changeset: created,
    };
  }
}
