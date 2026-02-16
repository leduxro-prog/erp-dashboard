import {
  CreateInvoiceUseCase,
  ISmartBillApiClient,
  IEventBus,
  IOrderService,
} from '../../src/application/use-cases/CreateInvoice';
import { ISmartBillRepository } from '../../src/domain/repositories/ISmartBillRepository';
import { SmartBillInvoice, InvoiceItem } from '../../src/domain/entities/SmartBillInvoice';
import { InvoiceCreationError } from '../../src/application/errors/smartbill.errors';

describe('CreateInvoiceUseCase', () => {
  let useCase: CreateInvoiceUseCase;
  let mockRepository: jest.Mocked<ISmartBillRepository>;
  let mockApiClient: jest.Mocked<ISmartBillApiClient>;
  let mockEventBus: jest.Mocked<IEventBus>;
  let mockOrderService: jest.Mocked<IOrderService>;

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
      createInvoice: jest.fn(),
    } as any;

    mockEventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockOrderService = {
      getOrderById: jest.fn(),
    } as any;

    useCase = new CreateInvoiceUseCase(
      mockRepository,
      mockApiClient,
      mockEventBus,
      mockOrderService,
    );
  });

  test('should create invoice successfully with valid data', async () => {
    const dto = {
      orderId: 'order-uuid-001',
      customerName: 'Test Company',
      customerVat: 'RO12345678',
      items: [
        {
          productName: 'Product 1',
          sku: 'SKU001',
          quantity: 2,
          unitPrice: 100,
          vatRate: 0.21,
          totalWithoutVat: 200,
          vatAmount: 38,
        },
      ],
      dueDate: new Date('2025-12-31'),
    };

    mockOrderService.getOrderById.mockResolvedValue({ id: 'order-uuid-001', total: 238 });
    mockApiClient.createInvoice.mockResolvedValue({
      id: 'sb123',
      number: 'FL/001',
      status: 'issued',
    });
    mockRepository.saveInvoice.mockResolvedValue(
      new SmartBillInvoice(
        1,
        'order-uuid-001',
        'sb123',
        'FL/001',
        'FL',
        'Test Company',
        'RO12345678',
        dto.items as InvoiceItem[],
        200,
        38,
        238,
        'RON',
        'issued',
        new Date(),
        new Date('2025-12-31'),
      ),
    );

    const result = await useCase.execute(dto);

    expect(result.invoiceNumber).toBe('FL/001');
    expect(result.smartBillId).toBe('sb123');
    expect(result.status).toBe('issued');
    expect(mockApiClient.createInvoice).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith('invoice.created', expect.any(Object));
  });

  test('should throw error when order not found', async () => {
    const dto = {
      orderId: 'order-uuid-999',
      customerName: 'Test Company',
      customerVat: 'RO12345678',
      items: [
        {
          productName: 'Product 1',
          sku: 'SKU001',
          quantity: 2,
          unitPrice: 100,
          vatRate: 0.21,
          totalWithoutVat: 200,
          vatAmount: 38,
        },
      ],
      dueDate: new Date('2025-12-31'),
    };

    mockOrderService.getOrderById.mockResolvedValue(null);

    await expect(useCase.execute(dto)).rejects.toThrow(InvoiceCreationError);
  });

  test('should handle API errors gracefully', async () => {
    const dto = {
      orderId: 'order-uuid-001',
      customerName: 'Test Company',
      customerVat: 'RO12345678',
      items: [
        {
          productName: 'Product 1',
          sku: 'SKU001',
          quantity: 2,
          unitPrice: 100,
          vatRate: 0.21,
          totalWithoutVat: 200,
          vatAmount: 38,
        },
      ],
      dueDate: new Date('2025-12-31'),
    };

    mockOrderService.getOrderById.mockResolvedValue({ id: 'order-uuid-001', total: 238 });
    mockApiClient.createInvoice.mockRejectedValue(new Error('API Error'));

    await expect(useCase.execute(dto)).rejects.toThrow(InvoiceCreationError);
  });

  test('should calculate VAT correctly', async () => {
    const vatAmount = SmartBillInvoice.calculateVat(100, 0.21);
    expect(vatAmount).toBe(21);
  });

  test('should create invoice with multiple items', async () => {
    const items = [
      {
        productName: 'Product 1',
        sku: 'SKU001',
        quantity: 2,
        unitPrice: 100,
        vatRate: 0.21,
        totalWithoutVat: 200,
        vatAmount: 38,
      },
      {
        productName: 'Product 2',
        sku: 'SKU002',
        quantity: 1,
        unitPrice: 50,
        vatRate: 0.21,
        totalWithoutVat: 50,
        vatAmount: 9.5,
      },
    ];

    const dto = {
      orderId: 'order-uuid-001',
      customerName: 'Test Company',
      customerVat: 'RO12345678',
      items: items as InvoiceItem[],
      dueDate: new Date('2025-12-31'),
    };

    mockOrderService.getOrderById.mockResolvedValue({ id: 'order-uuid-001' });
    mockApiClient.createInvoice.mockResolvedValue({
      id: 'sb123',
      number: 'FL/001',
      status: 'issued',
    });
    mockRepository.saveInvoice.mockResolvedValue(
      new SmartBillInvoice(
        1,
        'order-uuid-001',
        'sb123',
        'FL/001',
        'FL',
        'Test Company',
        'RO12345678',
        items as InvoiceItem[],
        250,
        47.5,
        297.5,
        'RON',
        'issued',
        new Date(),
        new Date('2025-12-31'),
      ),
    );

    const result = await useCase.execute(dto);

    expect(result.totalWithVat).toBe(297.5);
    expect(result.items.length).toBe(2);
  });

  test('should return existing invoice without calling SmartBill API', async () => {
    const dto = {
      orderId: 'order-uuid-001',
      customerName: 'Test Company',
      customerVat: 'RO12345678',
      items: [
        {
          productName: 'Product 1',
          sku: 'SKU001',
          quantity: 2,
          unitPrice: 100,
          vatRate: 0.21,
          totalWithoutVat: 200,
          vatAmount: 38,
        },
      ],
      dueDate: new Date('2025-12-31'),
    };

    const existingInvoice = new SmartBillInvoice(
      1,
      'order-uuid-001',
      'sb123',
      'FL/001',
      'FL',
      'Test Company',
      'RO12345678',
      dto.items as InvoiceItem[],
      200,
      38,
      238,
      'RON',
      'issued',
      new Date(),
      new Date('2025-12-31'),
    );

    mockRepository.getInvoiceByOrderId.mockResolvedValue(existingInvoice);

    const result = await useCase.execute(dto);

    expect(result.id).toBe(1);
    expect(result.smartBillId).toBe('sb123');
    expect(mockOrderService.getOrderById).not.toHaveBeenCalled();
    expect(mockApiClient.createInvoice).not.toHaveBeenCalled();
    expect(mockRepository.saveInvoice).not.toHaveBeenCalled();
  });

  test('should return existing invoice when save races and duplicate already exists', async () => {
    const dto = {
      orderId: 'order-uuid-001',
      customerName: 'Test Company',
      customerVat: 'RO12345678',
      items: [
        {
          productName: 'Product 1',
          sku: 'SKU001',
          quantity: 2,
          unitPrice: 100,
          vatRate: 0.21,
          totalWithoutVat: 200,
          vatAmount: 38,
        },
      ],
      dueDate: new Date('2025-12-31'),
    };

    const existingInvoice = new SmartBillInvoice(
      2,
      'order-uuid-001',
      'sb-race',
      'FL/002',
      'FL',
      'Test Company',
      'RO12345678',
      dto.items as InvoiceItem[],
      200,
      38,
      238,
      'RON',
      'issued',
      new Date(),
      new Date('2025-12-31'),
    );

    mockRepository.getInvoiceByOrderId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingInvoice);
    mockOrderService.getOrderById.mockResolvedValue({ id: 'order-uuid-001', total: 238 });
    mockApiClient.createInvoice.mockResolvedValue({
      id: 'sb-race',
      number: 'FL/002',
      status: 'issued',
    });
    mockRepository.saveInvoice.mockRejectedValue(
      new Error('duplicate key value violates unique constraint'),
    );

    const result = await useCase.execute(dto);

    expect(result.id).toBe(2);
    expect(result.invoiceNumber).toBe('FL/002');
  });
});
