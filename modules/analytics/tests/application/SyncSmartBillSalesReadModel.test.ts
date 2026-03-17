import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  SmartBillInvoiceListPort,
  SyncSmartBillSalesReadModel,
} from '@modules/analytics/src/application/use-cases/SyncSmartBillSalesReadModel';
import {
  ISalesReadModelRepository,
} from '@modules/analytics/src/application/ports/ISalesReadModelRepository';

describe('SyncSmartBillSalesReadModel', () => {
  let repository: jest.Mocked<ISalesReadModelRepository>;
  let listInvoices: jest.MockedFunction<SmartBillInvoiceListPort['listInvoices']>;
  let useCase: SyncSmartBillSalesReadModel;

  beforeEach(() => {
    repository = {
      upsertDocuments: jest.fn(),
      rebuildDailyAggregates: jest.fn(),
    };

    listInvoices = jest.fn<SmartBillInvoiceListPort['listInvoices']>();

    useCase = new SyncSmartBillSalesReadModel(repository, {
      listInvoices,
    });
  });

  it('syncs date window and persists documents plus aggregates', async () => {
    listInvoices.mockResolvedValue([
      {
        id: 'INV-100',
        seriesName: 'FCT',
        number: '100',
        issueDate: '2026-03-16',
        dueDate: '2026-03-30',
        companyName: 'Alpha SRL',
        companyVatCode: 'RO123',
        currency: 'RON',
        totalValue: 100,
        vatValue: 19,
      },
    ]);
    repository.upsertDocuments.mockResolvedValue(1);
    repository.rebuildDailyAggregates.mockResolvedValue(1);

    const result = await useCase.execute({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(listInvoices).toHaveBeenCalledWith({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(repository.upsertDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          documentKey: 'invoice:INV-100',
          documentType: 'invoice',
          smartbillId: 'INV-100',
          issueDate: '2026-03-16',
          dueDate: '2026-03-30',
          customerName: 'Alpha SRL',
          customerVat: 'RO123',
          currency: 'RON',
          totalWithoutVat: 81,
          vatAmount: 19,
          totalWithVat: 100,
        }),
      ]),
    );

    expect(repository.rebuildDailyAggregates).toHaveBeenCalledWith({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(result).toEqual({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
      fetchedDocuments: 1,
      normalizedDocuments: 1,
      upsertedDocuments: 1,
      recomputedDailyRows: 1,
    });
  });

  it('deduplicates invoices by document key in the same batch', async () => {
    listInvoices.mockResolvedValue([
      {
        seriesName: 'FCT',
        number: '101',
        issueDate: '2026-03-17',
        totalValue: 50,
      },
      {
        seriesName: 'FCT',
        number: '101',
        issueDate: '2026-03-17',
        totalValue: 50,
      },
    ]);
    repository.upsertDocuments.mockResolvedValue(1);
    repository.rebuildDailyAggregates.mockResolvedValue(1);

    await useCase.execute({
      startDate: '2026-03-01',
      endDate: '2026-03-31',
    });

    expect(repository.upsertDocuments).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          documentKey: 'invoice:FCT:101',
        }),
      ]),
    );
    expect(repository.upsertDocuments).toHaveBeenCalledWith(expect.any(Array));
    expect(repository.upsertDocuments.mock.calls[0][0]).toHaveLength(1);
  });

  it('keeps deterministic winner for duplicate keys regardless of input order', async () => {
    const newer = {
      id: 'INV-200',
      issueDate: '2026-03-17',
      totalValue: 125,
      vatValue: 25,
      updatedAt: '2026-03-20T10:00:00.000Z',
      companyName: 'Deterministic SRL',
      companyVatCode: 'RODET',
    };

    const older = {
      id: 'INV-200',
      issueDate: '2026-03-17',
      totalValue: 100,
      vatValue: 19,
      updatedAt: '2026-03-19T10:00:00.000Z',
      companyName: 'Deterministic SRL',
      companyVatCode: 'RODET',
    };

    repository.upsertDocuments.mockResolvedValue(1);
    repository.rebuildDailyAggregates.mockResolvedValue(1);

    listInvoices.mockResolvedValue([older, newer]);
    await useCase.execute({ startDate: '2026-03-01', endDate: '2026-03-31' });
    const firstCallDoc = repository.upsertDocuments.mock.calls[0][0][0];

    listInvoices.mockResolvedValue([newer, older]);
    await useCase.execute({ startDate: '2026-03-01', endDate: '2026-03-31' });
    const secondCallDoc = repository.upsertDocuments.mock.calls[1][0][0];

    expect(firstCallDoc.documentKey).toBe('invoice:INV-200');
    expect(secondCallDoc.documentKey).toBe('invoice:INV-200');
    expect(firstCallDoc.totalWithVat).toBe(125);
    expect(secondCallDoc.totalWithVat).toBe(125);
    expect(firstCallDoc.sourceUpdatedAt).toBe('2026-03-20T10:00:00.000Z');
    expect(secondCallDoc.sourceUpdatedAt).toBe('2026-03-20T10:00:00.000Z');
  });

  it('rejects invalid date window', async () => {
    await expect(
      useCase.execute({
        startDate: '2026-03-31',
        endDate: '2026-03-01',
      }),
    ).rejects.toThrow('startDate must be less than or equal to endDate');
  });

  it('rejects malformed raw window dates', async () => {
    await expect(
      useCase.execute({
        startDate: '2026/03/01',
        endDate: '2026-03-31',
      }),
    ).rejects.toThrow('startDate and endDate must be valid dates in YYYY-MM-DD format');
  });

  it('rejects impossible calendar dates in raw window input', async () => {
    await expect(
      useCase.execute({
        startDate: '2026-02-31',
        endDate: '2026-03-31',
      }),
    ).rejects.toThrow('startDate and endDate must be valid dates in YYYY-MM-DD format');
  });
});
