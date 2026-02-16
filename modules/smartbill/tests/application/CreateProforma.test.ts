import {
  CreateProformaUseCase,
  ISmartBillApiClientProforma,
  IEventBusProforma,
  IOrderServiceProforma,
} from '../../src/application/use-cases/CreateProforma';
import { ISmartBillRepository } from '../../src/domain/repositories/ISmartBillRepository';
import { SmartBillProforma } from '../../src/domain/entities/SmartBillProforma';
import { ProformaCreationError } from '../../src/application/errors/smartbill.errors';

describe('CreateProformaUseCase', () => {
  let useCase: CreateProformaUseCase;
  let mockRepository: jest.Mocked<ISmartBillRepository>;
  let mockApiClient: jest.Mocked<ISmartBillApiClientProforma>;
  let mockEventBus: jest.Mocked<IEventBusProforma>;
  let mockOrderService: jest.Mocked<IOrderServiceProforma>;

  const dto = {
    orderId: 'order-uuid-001',
    customerName: 'Acme SRL',
    customerVat: 'RO12345678',
    items: [
      {
        productName: 'LED Panel 60x60',
        sku: 'LED-001',
        quantity: 2,
        unitPrice: 100,
        vatRate: 0.21,
        totalWithoutVat: 200,
        vatAmount: 38,
      },
    ],
    dueDate: new Date('2026-12-31'),
  };

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

    mockOrderService = {
      getOrderById: jest.fn(),
    } as any;

    useCase = new CreateProformaUseCase(
      mockRepository,
      mockApiClient,
      mockEventBus,
      mockOrderService,
    );
  });

  test('should create proforma successfully with valid data', async () => {
    mockOrderService.getOrderById.mockResolvedValue({ id: dto.orderId, total: 238 });
    mockApiClient.createProforma.mockResolvedValue({
      id: 'spf-001',
      number: 'PF/001',
      status: 'issued',
    });
    mockRepository.saveProforma.mockResolvedValue(
      new SmartBillProforma(
        1,
        dto.orderId,
        'spf-001',
        'PF/001',
        'PF',
        dto.customerName,
        dto.customerVat,
        dto.items,
        200,
        38,
        238,
        'RON',
        'issued',
        new Date('2026-01-01'),
        dto.dueDate,
      ),
    );

    const result = await useCase.execute(dto);

    expect(result.proformaNumber).toBe('PF/001');
    expect(result.smartBillId).toBe('spf-001');
    expect(result.status).toBe('issued');
    expect(mockEventBus.publish).toHaveBeenCalledWith('proforma.created', expect.any(Object));
  });

  test('should throw error when order not found', async () => {
    mockOrderService.getOrderById.mockResolvedValue(null);

    await expect(useCase.execute(dto)).rejects.toThrow(ProformaCreationError);
  });

  test('should wrap API errors into ProformaCreationError', async () => {
    mockOrderService.getOrderById.mockResolvedValue({ id: dto.orderId });
    mockApiClient.createProforma.mockRejectedValue(new Error('API Error'));

    await expect(useCase.execute(dto)).rejects.toThrow(ProformaCreationError);
  });

  test('should send expected payload to SmartBill client', async () => {
    mockOrderService.getOrderById.mockResolvedValue({ id: dto.orderId });
    mockApiClient.createProforma.mockResolvedValue({
      id: 'spf-001',
      number: 'PF/001',
      status: 'issued',
    });
    mockRepository.saveProforma.mockImplementation(async (proforma) => proforma);

    await useCase.execute({
      ...dto,
      series: 'PFX',
      currency: 'EUR',
    });

    expect(mockApiClient.createProforma).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: dto.customerName,
        companyVat: dto.customerVat,
        proformaSeries: 'PFX',
        currency: 'EUR',
        items: [
          expect.objectContaining({
            name: 'LED Panel 60x60',
            quantity: 2,
            price: 100,
            vat: 21,
          }),
        ],
      }),
    );
  });
});
