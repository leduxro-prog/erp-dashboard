import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import {
  ConvertProformaToInvoiceUseCase,
  ISmartBillApiClientConvert,
  IEventBusConvert,
  IOrderServiceConvert,
  ProformaConversionError,
} from '../../src/application/use-cases/ConvertProformaToInvoice';
import { ISmartBillRepository } from '../../src/domain/repositories/ISmartBillRepository';
import { SmartBillInvoice, InvoiceItem } from '../../src/domain/entities/SmartBillInvoice';
import { SmartBillProforma } from '../../src/domain/entities/SmartBillProforma';
import { DataSource } from 'typeorm';

const sampleItems: InvoiceItem[] = [
  {
    productName: 'Product 1',
    sku: 'SKU001',
    quantity: 2,
    unitPrice: 100,
    vatRate: 0.19,
    totalWithoutVat: 200,
    vatAmount: 38,
  },
];

function buildProforma(overrides: Partial<SmartBillProforma> = {}): SmartBillProforma {
  const proforma = new SmartBillProforma(
    overrides.id ?? 1,
    overrides.orderId ?? 'order-uuid-001',
    overrides.smartBillId ?? 'sb-proforma-001',
    overrides.proformaNumber ?? 'PF/001',
    overrides.series ?? 'PF',
    overrides.customerName ?? 'Test Company',
    overrides.customerVat ?? 'RO12345678',
    overrides.items ?? sampleItems,
    overrides.totalWithoutVat ?? 200,
    overrides.vatAmount ?? 38,
    overrides.totalWithVat ?? 238,
    overrides.currency ?? 'RON',
    overrides.status ?? 'issued',
    overrides.issueDate ?? new Date('2025-06-01'),
    overrides.dueDate ?? new Date('2025-07-01'),
    overrides.createdAt ?? new Date('2025-06-01'),
  );
  return proforma;
}

describe('ConvertProformaToInvoiceUseCase', () => {
  let useCase: ConvertProformaToInvoiceUseCase;
  let mockRepository: jest.Mocked<ISmartBillRepository>;
  let mockApiClient: jest.Mocked<ISmartBillApiClientConvert>;
  let mockEventBus: jest.Mocked<IEventBusConvert>;
  let mockOrderService: jest.Mocked<IOrderServiceConvert>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockDataSource: { query: jest.Mock<any> };

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
      convertProformaToInvoice: jest.fn(),
    } as any;

    mockEventBus = {
      publish: jest.fn<any>().mockResolvedValue(undefined),
    } as any;

    mockOrderService = {
      getOrderById: jest.fn(),
      updateOrderWithSmartBillId: jest.fn<any>().mockResolvedValue({
        success: true,
        orderNumber: 'ORD-001',
      }),
    } as any;

    mockDataSource = {
      query: jest.fn(),
    };

    useCase = new ConvertProformaToInvoiceUseCase(
      mockRepository,
      mockApiClient,
      mockEventBus,
      mockOrderService,
      mockDataSource as unknown as DataSource,
    );
  });

  test('should convert proforma to invoice successfully', async () => {
    const proforma = buildProforma();

    mockRepository.getProforma.mockResolvedValue(proforma);
    mockApiClient.convertProformaToInvoice.mockResolvedValue({
      id: 'sb-invoice-001',
      number: 'FL/001',
      invoiceSeries: 'FL',
      invoiceNumber: 'FL/001',
    });
    mockRepository.saveInvoice.mockResolvedValue(
      new SmartBillInvoice(
        10,
        'order-uuid-001',
        'sb-invoice-001',
        'FL/001',
        'FL',
        'Test Company',
        'RO12345678',
        sampleItems,
        200,
        38,
        238,
        'RON',
        'issued',
        new Date(),
        new Date('2025-07-01'),
      ),
    );

    const result = await useCase.execute(1);

    expect(result.smartBillId).toBe('sb-invoice-001');
    expect(result.invoiceNumber).toBe('FL/001');
    expect(result.status).toBe('issued');
    expect(mockApiClient.convertProformaToInvoice).toHaveBeenCalledWith('PF', 'PF/001');
    expect(mockRepository.updateProforma).toHaveBeenCalled();
    expect(mockRepository.saveInvoice).toHaveBeenCalled();
  });

  test('should reject already converted proforma', async () => {
    const proforma = buildProforma({ status: 'converted' });
    mockRepository.getProforma.mockResolvedValue(proforma);

    await expect(useCase.execute(1)).rejects.toThrow(ProformaConversionError);
    await expect(useCase.execute(1)).rejects.toThrow('already been converted');
    expect(mockApiClient.convertProformaToInvoice).not.toHaveBeenCalled();
  });

  test('should reject cancelled proforma', async () => {
    const proforma = buildProforma({ status: 'cancelled' });
    mockRepository.getProforma.mockResolvedValue(proforma);

    await expect(useCase.execute(1)).rejects.toThrow(ProformaConversionError);
    await expect(useCase.execute(1)).rejects.toThrow('cancelled proforma');
    expect(mockApiClient.convertProformaToInvoice).not.toHaveBeenCalled();
  });

  test('should handle API errors during conversion', async () => {
    const proforma = buildProforma();
    mockRepository.getProforma.mockResolvedValue(proforma);
    mockApiClient.convertProformaToInvoice.mockRejectedValue(new Error('SmartBill API timeout'));

    await expect(useCase.execute(1)).rejects.toThrow(ProformaConversionError);
    await expect(useCase.execute(1)).rejects.toThrow('Failed to convert proforma');
  });

  test('should publish correct events on success', async () => {
    const proforma = buildProforma();

    mockRepository.getProforma.mockResolvedValue(proforma);
    mockApiClient.convertProformaToInvoice.mockResolvedValue({
      id: 'sb-invoice-002',
      number: 'FL/002',
      invoiceSeries: 'FL',
      invoiceNumber: 'FL/002',
    });
    mockRepository.saveInvoice.mockResolvedValue(
      new SmartBillInvoice(
        11,
        'order-uuid-001',
        'sb-invoice-002',
        'FL/002',
        'FL',
        'Test Company',
        'RO12345678',
        sampleItems,
        200,
        38,
        238,
        'RON',
        'issued',
        new Date(),
        new Date('2025-07-01'),
      ),
    );

    await useCase.execute(1);

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'smartbill.proforma_converted',
      expect.objectContaining({
        proformaId: 1,
        orderId: 'order-uuid-001',
        invoiceSmartBillId: 'sb-invoice-002',
        invoiceNumber: 'FL/002',
      }),
    );
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'invoice.created',
      expect.objectContaining({
        invoiceId: 11,
        orderId: 'order-uuid-001',
        smartBillId: 'sb-invoice-002',
        source: 'proforma_conversion',
      }),
    );
  });

  test('should update order with new invoice ID', async () => {
    const proforma = buildProforma();

    mockRepository.getProforma.mockResolvedValue(proforma);
    mockApiClient.convertProformaToInvoice.mockResolvedValue({
      id: 'sb-invoice-003',
      number: 'FL/003',
      invoiceSeries: 'FL',
      invoiceNumber: 'FL/003',
    });
    mockRepository.saveInvoice.mockResolvedValue(
      new SmartBillInvoice(
        12,
        'order-uuid-001',
        'sb-invoice-003',
        'FL/003',
        'FL',
        'Test Company',
        'RO12345678',
        sampleItems,
        200,
        38,
        238,
        'RON',
        'issued',
        new Date(),
        new Date('2025-07-01'),
      ),
    );

    await useCase.execute(1);

    expect(mockOrderService.updateOrderWithSmartBillId).toHaveBeenCalledWith({
      orderId: 'order-uuid-001',
      smartBillInvoiceId: 'sb-invoice-003',
      invoiceNumber: 'FL/003',
      invoiceSeries: 'FL',
      status: 'ISSUED',
    });
  });
});
