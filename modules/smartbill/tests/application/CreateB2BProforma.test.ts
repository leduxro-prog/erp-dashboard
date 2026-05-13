import { DataSource } from 'typeorm';

import {
  CreateB2BProformaUseCase,
  ISmartBillApiClientForB2BProforma,
  IEventBusForB2BProforma,
} from '../../src/application/use-cases/CreateB2BProforma';
import { ProformaCreationError } from '../../src/application/errors/smartbill.errors';
import { SmartBillProforma } from '../../src/domain/entities/SmartBillProforma';
import { ISmartBillRepository } from '../../src/domain/repositories/ISmartBillRepository';

describe('CreateB2BProformaUseCase', () => {
  let useCase: CreateB2BProformaUseCase;
  let mockRepository: jest.Mocked<ISmartBillRepository>;
  let mockApiClient: jest.Mocked<ISmartBillApiClientForB2BProforma>;
  let mockEventBus: jest.Mocked<IEventBusForB2BProforma>;
  let mockDataSource: jest.Mocked<Pick<DataSource, 'query'>>;

  beforeEach(() => {
    mockRepository = {
      saveInvoice: jest.fn(),
      getInvoice: jest.fn(),
      getInvoiceByOrderId: jest.fn(),
      getInvoicesByStatus: jest.fn(),
      updateInvoice: jest.fn(),
      saveProforma: jest.fn(),
      getProforma: jest.fn(),
      getProformaByOrderId: jest.fn(),
      getProformasByStatus: jest.fn(),
      updateProforma: jest.fn(),
      saveStockSync: jest.fn(),
      getLastSyncTime: jest.fn(),
      getStockSyncHistory: jest.fn(),
      getStockByProductSku: jest.fn(),
    } as any;

    mockApiClient = {
      createProforma: jest.fn(),
    } as any;

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockDataSource = {
      query: jest.fn(),
    } as any;

    useCase = new CreateB2BProformaUseCase(
      mockRepository,
      mockApiClient,
      mockEventBus,
      mockDataSource as unknown as DataSource,
    );
  });

  it('rejects B2B orders without invoiceable customer details before calling SmartBill', async () => {
    mockRepository.getProformaByOrderId.mockResolvedValue(null);
    mockDataSource.query
      .mockResolvedValueOnce([
        {
          id: 42,
          order_number: 'B2B-20260512-0001',
          customer_id: 10,
          total: 121,
          subtotal: 100,
          vat_amount: 21,
          currency_code: 'RON',
          payment_due_date: new Date('2026-06-11'),
          created_at: new Date('2026-05-12'),
          company_name: null,
          cui: null,
          tax_identification_number: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          sku: 'LED-001',
          product_name: 'LED Panel',
          quantity: 1,
          unit_price: 100,
          total_price: 100,
        },
      ]);

    await expect(useCase.execute({ b2bOrderId: 42 })).rejects.toThrow(ProformaCreationError);

    expect(mockApiClient.createProforma).not.toHaveBeenCalled();
    expect(mockRepository.saveProforma).not.toHaveBeenCalled();
  });

  it('creates a SmartBill proforma for a complete B2B order', async () => {
    mockRepository.getProformaByOrderId.mockResolvedValue(null);
    mockDataSource.query
      .mockResolvedValueOnce([
        {
          id: 42,
          order_number: 'B2B-20260512-0001',
          customer_id: 10,
          total: 121,
          subtotal: 100,
          vat_amount: 21,
          currency_code: 'RON',
          payment_due_date: new Date('2026-06-11'),
          created_at: new Date('2026-05-12'),
          company_name: 'Acme SRL',
          cui: 'RO12345678',
          tax_identification_number: null,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          sku: 'LED-001',
          product_name: 'LED Panel',
          quantity: 2,
          unit_price: 50,
          total_price: 100,
        },
      ])
      .mockResolvedValueOnce([]);

    mockApiClient.createProforma.mockResolvedValue({
      id: 'spf-b2b-001',
      number: 'PF/001',
      status: 'sent',
    });
    mockRepository.saveProforma.mockImplementation(async (proforma) =>
      new SmartBillProforma(
        1,
        proforma.orderId,
        proforma.smartBillId,
        proforma.proformaNumber,
        proforma.series,
        proforma.customerName,
        proforma.customerVat,
        proforma.items,
        proforma.totalWithoutVat,
        proforma.vatAmount,
        proforma.totalWithVat,
        proforma.currency,
        proforma.status,
        proforma.issueDate,
        proforma.dueDate,
      ),
    );

    const result = await useCase.execute({ b2bOrderId: 42 });

    expect(result.orderId).toBe('B2B-42');
    expect(result.proformaNumber).toBe('PF/001');
    expect(mockApiClient.createProforma).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Acme SRL',
        companyVat: 'RO12345678',
        proformaSeries: 'PF',
        currency: 'RON',
      }),
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'smartbill.b2b_proforma_created',
      expect.objectContaining({ b2bOrderId: 42 }),
    );
  });

  it('persists a pending_external local proforma before creating the external SmartBill proforma', async () => {
    mockRepository.getProformaByOrderId.mockResolvedValue(null);
    mockDataSource.query
      .mockResolvedValueOnce([
        {
          id: 42,
          order_number: 'B2B-20260512-0001',
          customer_id: 10,
          total: 121,
          subtotal: 100,
          vat_amount: 21,
          currency_code: 'RON',
          payment_due_date: new Date('2026-06-11'),
          created_at: new Date('2026-05-12'),
          company_name: 'Acme SRL',
          cui: 'RO12345678',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          sku: 'LED-001',
          product_name: 'LED Panel',
          quantity: 2,
          unit_price: 50,
          total_price: 100,
        },
      ])
      .mockResolvedValueOnce([]);

    mockRepository.saveProforma.mockImplementation(async (proforma) =>
      new SmartBillProforma(
        1,
        proforma.orderId,
        proforma.smartBillId,
        proforma.proformaNumber,
        proforma.series,
        proforma.customerName,
        proforma.customerVat,
        proforma.items,
        proforma.totalWithoutVat,
        proforma.vatAmount,
        proforma.totalWithVat,
        proforma.currency,
        proforma.status,
        proforma.issueDate,
        proforma.dueDate,
      ),
    );
    mockApiClient.createProforma.mockResolvedValue({
      id: 'spf-b2b-001',
      number: 'PF/001',
      status: 'sent',
    });
    mockRepository.updateProforma.mockResolvedValue(undefined);

    await useCase.execute({ b2bOrderId: 42 });

    expect(mockRepository.saveProforma).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'B2B-42', status: 'pending_external' }),
    );
    expect(mockRepository.saveProforma.mock.invocationCallOrder[0]).toBeLessThan(
      mockApiClient.createProforma.mock.invocationCallOrder[0],
    );
    expect(mockRepository.updateProforma).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'B2B-42',
        smartBillId: 'spf-b2b-001',
        proformaNumber: 'PF/001',
        status: 'sent',
      }),
    );
  });

  it('does not call SmartBill again when a pending local proforma already exists', async () => {
    mockRepository.getProformaByOrderId.mockResolvedValue(
      new SmartBillProforma(
        1,
        'B2B-42',
        undefined,
        undefined,
        'PF',
        'Acme SRL',
        'RO12345678',
        [
          {
            productName: 'LED Panel',
            sku: 'LED-001',
            quantity: 2,
            unitPrice: 50,
            vatRate: 0.21,
            totalWithoutVat: 100,
            vatAmount: 21,
          },
        ],
        100,
        21,
        121,
        'RON',
        'pending_external',
        new Date('2026-05-12'),
        new Date('2026-06-11'),
      ),
    );

    await expect(useCase.execute({ b2bOrderId: 42 })).rejects.toThrow(ProformaCreationError);

    expect(mockApiClient.createProforma).not.toHaveBeenCalled();
    expect(mockRepository.saveProforma).not.toHaveBeenCalled();
    expect(mockRepository.updateProforma).not.toHaveBeenCalled();
    expect(mockDataSource.query).not.toHaveBeenCalled();
  });

  it('does not call SmartBill again when a proforma requires reconciliation', async () => {
    mockRepository.getProformaByOrderId.mockResolvedValue(
      new SmartBillProforma(
        1,
        'B2B-42',
        undefined,
        undefined,
        'PF',
        'Acme SRL',
        'RO12345678',
        [
          {
            productName: 'LED Panel',
            sku: 'LED-001',
            quantity: 2,
            unitPrice: 50,
            vatRate: 0.21,
            totalWithoutVat: 100,
            vatAmount: 21,
          },
        ],
        100,
        21,
        121,
        'RON',
        'requires_reconciliation',
        new Date('2026-05-12'),
        new Date('2026-06-11'),
      ),
    );

    await expect(useCase.execute({ b2bOrderId: 42 })).rejects.toThrow(ProformaCreationError);

    expect(mockApiClient.createProforma).not.toHaveBeenCalled();
    expect(mockRepository.saveProforma).not.toHaveBeenCalled();
    expect(mockRepository.updateProforma).not.toHaveBeenCalled();
    expect(mockDataSource.query).not.toHaveBeenCalled();
  });

  it('does not call SmartBill again when an existing failed proforma has external identifiers', async () => {
    mockRepository.getProformaByOrderId.mockResolvedValue(
      new SmartBillProforma(
        1,
        'B2B-42',
        'spf-b2b-001',
        'PF/001',
        'PF',
        'Acme SRL',
        'RO12345678',
        [
          {
            productName: 'LED Panel',
            sku: 'LED-001',
            quantity: 2,
            unitPrice: 50,
            vatRate: 0.21,
            totalWithoutVat: 100,
            vatAmount: 21,
          },
        ],
        100,
        21,
        121,
        'RON',
        'failed',
        new Date('2026-05-12'),
        new Date('2026-06-11'),
      ),
    );

    await expect(useCase.execute({ b2bOrderId: 42 })).rejects.toThrow(ProformaCreationError);

    expect(mockApiClient.createProforma).not.toHaveBeenCalled();
    expect(mockRepository.saveProforma).not.toHaveBeenCalled();
    expect(mockRepository.updateProforma).not.toHaveBeenCalled();
    expect(mockDataSource.query).not.toHaveBeenCalled();
  });

  it('does not call SmartBill when another worker already inserted the pending proforma', async () => {
    mockRepository.getProformaByOrderId.mockResolvedValueOnce(null).mockResolvedValueOnce(
      new SmartBillProforma(
        1,
        'B2B-42',
        undefined,
        undefined,
        'PF',
        'Acme SRL',
        'RO12345678',
        [
          {
            productName: 'LED Panel',
            sku: 'LED-001',
            quantity: 2,
            unitPrice: 50,
            vatRate: 0.21,
            totalWithoutVat: 100,
            vatAmount: 21,
          },
        ],
        100,
        21,
        121,
        'RON',
        'pending_external',
        new Date('2026-05-12'),
        new Date('2026-06-11'),
      ),
    );
    mockDataSource.query
      .mockResolvedValueOnce([
        {
          id: 42,
          order_number: 'B2B-20260512-0001',
          customer_id: 10,
          total: 121,
          subtotal: 100,
          vat_amount: 21,
          currency_code: 'RON',
          payment_due_date: new Date('2026-06-11'),
          created_at: new Date('2026-05-12'),
          company_name: 'Acme SRL',
          cui: 'RO12345678',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          sku: 'LED-001',
          product_name: 'LED Panel',
          quantity: 2,
          unit_price: 50,
          total_price: 100,
        },
      ]);
    mockRepository.saveProforma.mockRejectedValue(
      Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }),
    );

    await expect(useCase.execute({ b2bOrderId: 42 })).rejects.toThrow(ProformaCreationError);

    expect(mockApiClient.createProforma).not.toHaveBeenCalled();
    expect(mockRepository.updateProforma).not.toHaveBeenCalled();
    expect(mockRepository.getProformaByOrderId).toHaveBeenCalledTimes(2);
  });

  it('marks the pending local draft for reconciliation when SmartBill rejects before returning a proforma id', async () => {
    mockRepository.getProformaByOrderId.mockResolvedValue(null);
    mockDataSource.query
      .mockResolvedValueOnce([
        {
          id: 42,
          order_number: 'B2B-20260512-0001',
          customer_id: 10,
          total: 121,
          subtotal: 100,
          vat_amount: 21,
          currency_code: 'RON',
          payment_due_date: new Date('2026-06-11'),
          created_at: new Date('2026-05-12'),
          company_name: 'Acme SRL',
          cui: 'RO12345678',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          sku: 'LED-001',
          product_name: 'LED Panel',
          quantity: 2,
          unit_price: 50,
          total_price: 100,
        },
      ]);

    mockRepository.saveProforma.mockImplementation(async (proforma) =>
      new SmartBillProforma(
        1,
        proforma.orderId,
        proforma.smartBillId,
        proforma.proformaNumber,
        proforma.series,
        proforma.customerName,
        proforma.customerVat,
        proforma.items,
        proforma.totalWithoutVat,
        proforma.vatAmount,
        proforma.totalWithVat,
        proforma.currency,
        proforma.status,
        proforma.issueDate,
        proforma.dueDate,
      ),
    );
    mockApiClient.createProforma.mockRejectedValue(new Error('SmartBill unavailable'));
    mockRepository.updateProforma.mockResolvedValue(undefined);

    await expect(useCase.execute({ b2bOrderId: 42 })).rejects.toThrow(ProformaCreationError);

    expect(mockRepository.updateProforma).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'B2B-42',
        smartBillId: undefined,
        proformaNumber: undefined,
        status: 'requires_reconciliation',
      }),
    );
  });
});
