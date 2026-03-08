import { describe, expect, it, jest } from '@jest/globals';
import { DataSource, EntityManager } from 'typeorm';
import { TypeOrmSeoDraftQueueRepository } from '../../src/infrastructure/repositories/TypeOrmSeoDraftQueueRepository';

type QueryMock = jest.MockedFunction<EntityManager['query']>;

const createInput = () => ({
  productId: 1001,
  locale: 'ro',
  fingerprint: 'fp-atomic',
  createdBy: 7,
  items: [
    {
      fieldName: 'metaTitle',
      currentValue: 'Old title',
      proposedValue: 'New title',
      aiConfidence: 0.9,
      reason: 'AI suggestion',
      isSelected: true,
    },
  ],
  metadata: { source: 'test' },
});

const createRepository = (options?: {
  txQueryImpl?: QueryMock;
  baseQueryImpl?: QueryMock;
  transactionImpl?: (run: (manager: EntityManager) => Promise<unknown>) => Promise<unknown>;
}) => {
  const baseQuery: QueryMock =
    options?.baseQueryImpl ??
    (jest.fn(async () => {
      throw new Error('base manager query should not be used');
    }) as QueryMock);

  const txQuery: QueryMock =
    options?.txQueryImpl ??
    (jest.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO seo_draft_changesets')) {
        return [
          {
            id: 22,
            product_id: 1001,
            locale: 'ro',
            fingerprint: 'fp-atomic',
            status: 'pending',
            is_active: true,
          },
        ];
      }

      if (sql.includes('SELECT field_name')) {
        return [];
      }

      return [];
    }) as QueryMock);

  const txManager = { query: txQuery } as unknown as EntityManager;
  const transaction =
    options?.transactionImpl ??
    jest.fn(async (run: (manager: EntityManager) => Promise<unknown>) => run(txManager));

  const dataSource = {
    manager: { query: baseQuery },
    transaction,
  } as unknown as DataSource;

  return {
    repository: new TypeOrmSeoDraftQueueRepository(dataSource),
    transaction,
    baseQuery,
    txQuery,
  };
};

describe('TypeOrmSeoDraftQueueRepository', () => {
  it('runs createChangeset in one transaction executor', async () => {
    const { repository, transaction, baseQuery, txQuery } = createRepository();

    const result = await repository.createChangeset(createInput());

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(baseQuery).not.toHaveBeenCalled();
    expect(txQuery).toHaveBeenCalled();
    expect(result.id).toBe(22);
    expect(result.items).toHaveLength(0);
  });

  it('propagates item insert failures from transactional createChangeset', async () => {
    const txQuery = jest.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO seo_draft_changesets')) {
        return [
          {
            id: 23,
            product_id: 1001,
            locale: 'ro',
            fingerprint: 'fp-atomic',
            status: 'pending',
            is_active: true,
          },
        ];
      }

      if (sql.includes('INSERT INTO seo_draft_items')) {
        throw new Error('item insert failed');
      }

      return [];
    }) as QueryMock;

    const { repository, transaction } = createRepository({ txQueryImpl: txQuery });

    await expect(repository.createChangeset(createInput())).rejects.toThrow('item insert failed');
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects metadata patch fields outside internal allowlist', async () => {
    const baseQuery = jest.fn(async () => []) as QueryMock;
    const dataSource = {
      manager: { query: baseQuery },
      transaction: jest.fn(),
    } as unknown as DataSource;
    const repository = new TypeOrmSeoDraftQueueRepository(dataSource);

    await expect(
      repository.applyMetadataPatch({
        productId: 1001,
        locale: 'ro',
        patch: {
          metaTitle: 'safe',
          notAColumn: 'unsafe',
        },
      }),
    ).rejects.toThrow('Unsupported metadata patch fields: notAColumn');

    expect(baseQuery).not.toHaveBeenCalled();
  });

  it('returns detailed changesets when filtering queue rows', async () => {
    const baseQuery = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT id, product_id, locale, fingerprint, status, is_active')) {
        return [
          {
            id: 41,
            product_id: 1001,
            locale: 'ro',
            fingerprint: 'fp-41',
            status: 'pending',
            is_active: true,
          },
        ];
      }

      if (sql.includes('SELECT changeset_id, field_name, current_value, proposed_value, ai_confidence, reason, is_selected')) {
        return [
          {
            changeset_id: 41,
            field_name: 'meta_title',
            current_value: 'Titlu vechi',
            proposed_value: 'Titlu nou',
            ai_confidence: 0.9,
            reason: 'Better relevance',
            is_selected: true,
          },
        ];
      }

      return [];
    }) as QueryMock;

    const dataSource = {
      manager: { query: baseQuery },
      transaction: jest.fn(),
    } as unknown as DataSource;
    const repository = new TypeOrmSeoDraftQueueRepository(dataSource);

    const rows = await repository.findByFilter({ productId: 1001, locale: 'ro', status: 'pending' });

    expect(rows).toEqual([
      {
        id: 41,
        productId: 1001,
        locale: 'ro',
        fingerprint: 'fp-41',
        status: 'pending',
        isActive: true,
        items: [
          {
            fieldName: 'meta_title',
            currentValue: 'Titlu vechi',
            proposedValue: 'Titlu nou',
            aiConfidence: 0.9,
            reason: 'Better relevance',
            isSelected: true,
          },
        ],
      },
    ]);
  });

  it('fetches a queue changeset by id directly', async () => {
    const baseQuery = jest.fn(async (sql: string, values: unknown[]) => {
      if (sql.includes('WHERE id = $1')) {
        expect(values).toEqual([77]);
        return [
          {
            id: 77,
            product_id: 1001,
            locale: 'ro',
            fingerprint: 'fp-77',
            status: 'approved',
            is_active: true,
          },
        ];
      }

      if (sql.includes('SELECT field_name, current_value, proposed_value, ai_confidence, reason, is_selected')) {
        return [];
      }

      return [];
    }) as QueryMock;

    const dataSource = {
      manager: { query: baseQuery },
      transaction: jest.fn(),
    } as unknown as DataSource;
    const repository = new TypeOrmSeoDraftQueueRepository(dataSource);

    const row = await repository.findById(77);

    expect(row).toEqual({
      id: 77,
      productId: 1001,
      locale: 'ro',
      fingerprint: 'fp-77',
      status: 'approved',
      isActive: true,
      items: [],
    });
  });

  it('maps metadata patch fields to snake_case seo_metadata columns', async () => {
    const baseQuery = jest.fn(async () => [{ id: 'meta-1' }]) as QueryMock;
    const dataSource = {
      manager: { query: baseQuery },
      transaction: jest.fn(),
    } as unknown as DataSource;
    const repository = new TypeOrmSeoDraftQueueRepository(dataSource);

    await repository.applyMetadataPatch({
      productId: 1001,
      locale: 'ro',
      patch: {
        metaTitle: 'Titlu nou',
        canonicalUrl: 'https://ledux.ro/produs/bec-led-10w',
      },
    });

    expect(baseQuery).toHaveBeenCalledTimes(1);
    const sql = String(baseQuery.mock.calls[0][0]);
    expect(sql).toContain('meta_title = $1');
    expect(sql).toContain('canonical_url = $2');
    expect(sql).toContain('updated_at = NOW()');
    expect(sql).toContain("entity_type = 'PRODUCT'");
    expect(sql).toContain('entity_id = $3');
  });

  it('throws when seo_metadata target row is missing during apply patch', async () => {
    const baseQuery = jest.fn(async () => []) as QueryMock;
    const dataSource = {
      manager: { query: baseQuery },
      transaction: jest.fn(),
    } as unknown as DataSource;
    const repository = new TypeOrmSeoDraftQueueRepository(dataSource);

    await expect(
      repository.applyMetadataPatch({
        productId: 1001,
        locale: 'ro',
        patch: {
          metaTitle: 'Titlu nou',
        },
      }),
    ).rejects.toThrow('SEO metadata row not found');
  });
});
