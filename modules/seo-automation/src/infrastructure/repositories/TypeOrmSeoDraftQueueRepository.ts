import { DataSource, EntityManager } from 'typeorm';
import {
  ApproveSeoDraftItemsFilter,
  IApproveSeoDraftItemsRepository,
} from '../../application/use-cases/ApproveSeoDraftItems';
import {
  IApplyApprovedSeoDraftsRepository,
  IApplyApprovedSeoDraftsTransactionRepository,
  ApplyApprovedSeoDraftsInput,
} from '../../application/use-cases/ApplyApprovedSeoDrafts';
import {
  EnqueueSeoDraftsInput,
  IEnqueueSeoDraftsRepository,
  SeoDraftChangeset,
  SeoDraftChangesetStatus,
  SeoDraftItem,
} from '../../application/use-cases/EnqueueSeoDrafts';

type QueryExecutor = Pick<EntityManager, 'query'>;

const METADATA_PATCH_COLUMN_ALLOWLIST = new Set([
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

const METADATA_PATCH_COLUMN_MAP: Record<string, string> = {
  metaTitle: 'meta_title',
  metaDescription: 'meta_description',
  slug: 'slug',
  canonicalUrl: 'canonical_url',
  ogTitle: 'og_title',
  ogDescription: 'og_description',
  ogImage: 'og_image',
  twitterTitle: 'twitter_title',
  twitterDescription: 'twitter_description',
  focusKeyword: 'focus_keyword',
};

export class TypeOrmSeoDraftQueueRepository
  implements
    IEnqueueSeoDraftsRepository,
    IApproveSeoDraftItemsRepository,
    IApplyApprovedSeoDraftsRepository,
    IApplyApprovedSeoDraftsTransactionRepository
{
  private readonly executor: QueryExecutor;
  private readonly manager?: EntityManager;

  constructor(
    private readonly dataSource: DataSource,
    manager?: EntityManager,
  ) {
    this.manager = manager;
    this.executor = manager ?? dataSource.manager;
  }

  async findActiveByFingerprint(input: {
    productId: number;
    locale: string;
    fingerprint: string;
  }): Promise<SeoDraftChangeset | null> {
    const rows = await this.executor.query(
      `
      SELECT id, product_id, locale, fingerprint, status, is_active
      FROM seo_draft_changesets
      WHERE product_id = $1 AND locale = $2 AND fingerprint = $3 AND is_active = true
      ORDER BY id DESC
      LIMIT 1
      `,
      [input.productId, input.locale, input.fingerprint],
    );

    if (rows.length === 0) {
      return null;
    }

    return this.hydrateChangeset(rows[0]);
  }

  async createChangeset(input: EnqueueSeoDraftsInput): Promise<SeoDraftChangeset> {
    return this.runInTransaction(async (executor) => {
      await executor.query(
        `
        UPDATE seo_draft_changesets
        SET status = 'superseded', is_active = false, superseded_at = NOW(), updated_at = NOW()
        WHERE product_id = $1 AND locale = $2 AND is_active = true
        `,
        [input.productId, input.locale],
      );

      const inserted = await executor.query(
        `
        INSERT INTO seo_draft_changesets (product_id, locale, fingerprint, status, is_active, created_by, metadata)
        VALUES ($1, $2, $3, 'pending', true, $4, $5::jsonb)
        RETURNING id, product_id, locale, fingerprint, status, is_active
        `,
        [
          input.productId,
          input.locale,
          input.fingerprint,
          input.createdBy ?? null,
          JSON.stringify(input.metadata ?? {}),
        ],
      );

      const changesetId = Number(inserted[0].id);
      for (const item of input.items) {
        await executor.query(
          `
          INSERT INTO seo_draft_items (
            changeset_id,
            field_name,
            current_value,
            proposed_value,
            ai_confidence,
            reason,
            is_selected
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (changeset_id, field_name)
          DO UPDATE SET
            current_value = EXCLUDED.current_value,
            proposed_value = EXCLUDED.proposed_value,
            ai_confidence = EXCLUDED.ai_confidence,
            reason = EXCLUDED.reason,
            is_selected = EXCLUDED.is_selected,
            updated_at = NOW()
          `,
          [
            changesetId,
            item.fieldName,
            item.currentValue ?? null,
            item.proposedValue ?? null,
            item.aiConfidence ?? null,
            item.reason ?? null,
            item.isSelected ?? true,
          ],
        );
      }

      const transactionalRepository = new TypeOrmSeoDraftQueueRepository(
        this.dataSource,
        executor as EntityManager,
      );

      return transactionalRepository.hydrateChangeset(inserted[0]);
    });
  }

  async findByFilter(
    filter: ApproveSeoDraftItemsFilter,
  ): Promise<SeoDraftChangeset[]> {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (typeof filter.productId === 'number') {
      values.push(filter.productId);
      clauses.push(`product_id = $${values.length}`);
    }

    if (filter.locale) {
      values.push(filter.locale);
      clauses.push(`locale = $${values.length}`);
    }

    if (filter.status) {
      values.push(filter.status);
      clauses.push(`status = $${values.length}`);
    }

    const isUnbounded = filter.unbounded === true;
    const limit = Number.isFinite(Number(filter.limit)) ? Math.max(1, Math.min(100, Number(filter.limit))) : 50;
    const page = Number.isFinite(Number(filter.page)) ? Math.max(1, Number(filter.page)) : 1;
    const offset = (page - 1) * limit;

    let paginationSql = '';
    if (!isUnbounded) {
      values.push(limit);
      const limitPosition = values.length;
      values.push(offset);
      const offsetPosition = values.length;
      paginationSql = `LIMIT $${limitPosition} OFFSET $${offsetPosition}`;
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = (await this.executor.query(
      `
      SELECT id, product_id, locale, fingerprint, status, is_active
      FROM seo_draft_changesets
      ${whereClause}
      ORDER BY id ASC
      ${paginationSql}
      `,
      values,
    )) as Record<string, unknown>[];

    return this.hydrateChangesets(rows);
  }

  async findById(changesetId: number): Promise<SeoDraftChangeset | null> {
    const rows = (await this.executor.query(
      `
      SELECT id, product_id, locale, fingerprint, status, is_active
      FROM seo_draft_changesets
      WHERE id = $1
      LIMIT 1
      `,
      [changesetId],
    )) as Record<string, unknown>[];

    if (rows.length === 0) {
      return null;
    }

    return this.hydrateChangeset(rows[0]);
  }

  async updateStatusBulk(input: {
    ids: number[];
    status: 'approved' | 'rejected';
    approvedBy?: number;
  }): Promise<number> {
    if (input.ids.length === 0) {
      return 0;
    }

    const rows = await this.executor.query(
      `
      UPDATE seo_draft_changesets
      SET
        status = $1,
        approved_by = $2,
        approved_at = NOW(),
        is_active = CASE WHEN $1 = 'rejected' THEN false ELSE is_active END,
        updated_at = NOW()
      WHERE id = ANY($3::bigint[]) AND status = 'pending'
      RETURNING id
      `,
      [input.status, input.approvedBy ?? null, input.ids],
    );

    return rows.length;
  }

  async withTransaction<T>(
    run: (repository: IApplyApprovedSeoDraftsTransactionRepository) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      const transactionalRepository = new TypeOrmSeoDraftQueueRepository(this.dataSource, manager);
      return run(transactionalRepository);
    });
  }

  async findApprovedChangesets(filter: ApplyApprovedSeoDraftsInput): Promise<SeoDraftChangeset[]> {
    const clauses = [`status = 'approved'`, 'is_active = true'];
    const values: unknown[] = [];

    if (typeof filter.productId === 'number') {
      values.push(filter.productId);
      clauses.push(`product_id = $${values.length}`);
    }

    if (filter.locale) {
      values.push(filter.locale);
      clauses.push(`locale = $${values.length}`);
    }

    const changesetRows = await this.executor.query(
      `
      SELECT id, product_id, locale, fingerprint, status, is_active
      FROM seo_draft_changesets
      WHERE ${clauses.join(' AND ')}
      ORDER BY id ASC
      `,
      values,
    );

    return this.hydrateChangesets(changesetRows as Record<string, unknown>[]);
  }

  async applyMetadataPatch(input: {
    productId: number;
    locale: string;
    patch: Record<string, string | null>;
  }): Promise<void> {
    const fields = Object.keys(input.patch);
    if (fields.length === 0) {
      return;
    }

    const unsupportedFields = fields.filter((field) => !METADATA_PATCH_COLUMN_ALLOWLIST.has(field));
    if (unsupportedFields.length > 0) {
      throw new Error(`Unsupported metadata patch fields: ${unsupportedFields.join(', ')}`);
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const field of fields) {
      values.push(input.patch[field]);
      const column = METADATA_PATCH_COLUMN_MAP[field];
      if (!column) {
        throw new Error(`Unsupported metadata patch column mapping for field: ${field}`);
      }
      sets.push(`${column} = $${values.length}`);
    }

    values.push(String(input.productId));
    const entityIdPosition = values.length;
    values.push(input.locale);
    const localePosition = values.length;

    const updatedRows = await this.executor.query(
      `
      UPDATE seo_metadata
      SET ${sets.join(', ')}, updated_at = NOW()
      WHERE entity_type = 'PRODUCT' AND entity_id = $${entityIdPosition} AND locale = $${localePosition}
      RETURNING id
      `,
      values,
    );

    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      throw new Error(
        `SEO metadata row not found for product ${input.productId} and locale ${input.locale}`,
      );
    }
  }

  async updateProductStateFingerprint(input: {
    productId: number;
    locale: string;
    fingerprint: string;
    changesetId: number;
  }): Promise<void> {
    await this.executor.query(
      `
      INSERT INTO seo_product_state (
        product_id,
        locale,
        last_fingerprint,
        last_changeset_id,
        last_generated_at,
        last_approved_at,
        metadata
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW(), '{}'::jsonb)
      ON CONFLICT (product_id, locale)
      DO UPDATE SET
        last_fingerprint = EXCLUDED.last_fingerprint,
        last_changeset_id = EXCLUDED.last_changeset_id,
        last_approved_at = NOW(),
        updated_at = NOW()
      `,
      [input.productId, input.locale, input.fingerprint, input.changesetId],
    );
  }

  async markChangesetApplied(input: { changesetId: number }): Promise<void> {
    await this.executor.query(
      `
      UPDATE seo_draft_changesets
      SET status = 'superseded', is_active = false, superseded_at = NOW(), updated_at = NOW()
      WHERE id = $1
      `,
      [input.changesetId],
    );
  }

  private async hydrateChangeset(row: Record<string, unknown>): Promise<SeoDraftChangeset> {
    const changesetId = Number(row.id);
    const itemRows = await this.executor.query(
      `
      SELECT field_name, current_value, proposed_value, ai_confidence, reason, is_selected
      FROM seo_draft_items
      WHERE changeset_id = $1
      ORDER BY id ASC
      `,
      [changesetId],
    );

    const items: SeoDraftItem[] = (itemRows as Record<string, unknown>[]).map((item) => ({
      fieldName: String(item.field_name),
      currentValue: (item.current_value as string | null) ?? null,
      proposedValue: (item.proposed_value as string | null) ?? null,
      aiConfidence:
        item.ai_confidence === null || item.ai_confidence === undefined
          ? null
          : Number(item.ai_confidence),
      reason: (item.reason as string | null) ?? null,
      isSelected: Boolean(item.is_selected),
    }));

    return {
      id: changesetId,
      productId: Number(row.product_id),
      locale: String(row.locale),
      fingerprint: String(row.fingerprint),
      status: String(row.status) as SeoDraftChangesetStatus,
      isActive: Boolean(row.is_active),
      items,
    };
  }

  private async hydrateChangesets(rows: Record<string, unknown>[]): Promise<SeoDraftChangeset[]> {
    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => Number(row.id));
    const itemRows = (await this.executor.query(
      `
      SELECT changeset_id, field_name, current_value, proposed_value, ai_confidence, reason, is_selected
      FROM seo_draft_items
      WHERE changeset_id = ANY($1::bigint[])
      ORDER BY changeset_id ASC, id ASC
      `,
      [ids],
    )) as Record<string, unknown>[];

    const itemMap = new Map<number, SeoDraftItem[]>();
    for (const item of itemRows) {
      const changesetId = Number(item.changeset_id);
      const current = itemMap.get(changesetId) || [];
      current.push({
        fieldName: String(item.field_name),
        currentValue: (item.current_value as string | null) ?? null,
        proposedValue: (item.proposed_value as string | null) ?? null,
        aiConfidence:
          item.ai_confidence === null || item.ai_confidence === undefined
            ? null
            : Number(item.ai_confidence),
        reason: (item.reason as string | null) ?? null,
        isSelected: Boolean(item.is_selected),
      });
      itemMap.set(changesetId, current);
    }

    return rows.map((row) => ({
      id: Number(row.id),
      productId: Number(row.product_id),
      locale: String(row.locale),
      fingerprint: String(row.fingerprint),
      status: String(row.status) as SeoDraftChangesetStatus,
      isActive: Boolean(row.is_active),
      items: itemMap.get(Number(row.id)) || [],
    }));
  }

  private async runInTransaction<T>(run: (executor: QueryExecutor) => Promise<T>): Promise<T> {
    if (this.manager) {
      return run(this.manager);
    }

    return this.dataSource.transaction(async (transactionManager) => run(transactionManager));
  }
}
