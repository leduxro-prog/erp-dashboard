import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { DataSource } from 'typeorm';

import { TypeOrmSalesReadModelRepository } from '@modules/analytics/src/infrastructure/repositories/TypeOrmSalesReadModelRepository';

describe('TypeOrmSalesReadModelRepository', () => {
  let query: jest.Mock;
  let transaction: any;
  let repository: TypeOrmSalesReadModelRepository;

  beforeEach(() => {
    query = jest.fn();
    transaction = jest.fn(async (callback: any) => {
      await callback({ query });
    });

    repository = new TypeOrmSalesReadModelRepository({
      query,
      transaction,
    } as unknown as DataSource);
  });

  it('upserts read-model documents by unique document key', async () => {
    (query as any).mockResolvedValue([
      { document_key: 'invoice:INV-1' },
      { document_key: 'invoice:INV-2' },
    ]);

    const result = await repository.upsertDocuments([
      {
        documentKey: 'invoice:INV-1',
        documentType: 'invoice',
        smartbillId: 'INV-1',
        series: 'FCT',
        number: '1',
        issueDate: '2026-03-10',
        currency: 'RON',
        totalWithoutVat: 100,
        vatAmount: 19,
        totalWithVat: 119,
        payload: { raw: true },
      },
      {
        documentKey: 'invoice:INV-2',
        documentType: 'invoice',
        smartbillId: 'INV-2',
        series: 'FCT',
        number: '2',
        issueDate: '2026-03-10',
        currency: 'RON',
        totalWithoutVat: 200,
        vatAmount: 38,
        totalWithVat: 238,
        payload: { raw: true },
      },
    ]);

    expect(result).toBe(2);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('ON CONFLICT (document_key) DO UPDATE');
    expect(query.mock.calls[0][1]).toHaveLength(1);
    const params = query.mock.calls[0][1] as unknown[];
    expect(JSON.parse(params[0] as string)).toHaveLength(2);
  });

  it('rebuilds daily aggregates for provided date window', async () => {
    (query as any)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ period_date: '2026-03-10' }, { period_date: '2026-03-11' }]);

    const result = await repository.rebuildDailyAggregates({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(result).toBe(2);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][0]).toContain('DELETE FROM sales_kpi_daily');
    expect(query.mock.calls[1][0]).toContain('INSERT INTO sales_kpi_daily');
    expect(query.mock.calls[1][0]).toContain('GROUP BY issue_date, currency');
    expect(query.mock.calls[0][1]).toEqual(['2026-03-01', '2026-03-31']);
    expect(query.mock.calls[1][1]).toEqual(['2026-03-01', '2026-03-31']);
  });
});
