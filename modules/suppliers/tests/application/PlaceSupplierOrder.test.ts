import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PlaceSupplierOrder } from '../../src/application/use-cases/PlaceSupplierOrder';
import { ISupplierRepository } from '../../src/domain';
import {
  InvalidOrderError,
  InsufficientStockError,
  SupplierNotFoundError,
} from '../../src/application/errors/supplier.errors';
import { SupplierCode } from '../../src/domain/entities/Supplier';
import { SupplierOrderStatus } from '../../src/domain/entities/SupplierOrder';

describe('PlaceSupplierOrder Use Case', () => {
  let useCase: PlaceSupplierOrder;
  let mockRepository: jest.Mocked<ISupplierRepository>;

  const mockSupplier = {
    id: 1,
    name: 'Supplier 1',
    code: SupplierCode.ACA_LIGHTING,
    website: 'https://supplier.test',
    contactEmail: 'contact@supplier.test',
    contactPhone: '+40111111111',
    whatsappNumber: '+40 711 111 111',
    productCount: 2,
    isActive: true,
    credentials: { username: 'u', password: 'p' },
    syncFrequency: 4,
    lastSync: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProducts = [
    {
      id: 1,
      supplierId: 1,
      supplierSku: 'SKU-001',
      name: 'Product 1',
      price: 100,
      currency: 'RON',
      stockQuantity: 50,
      lastScraped: new Date(),
      priceHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      supplierId: 1,
      supplierSku: 'SKU-002',
      name: 'Product 2',
      price: 200,
      currency: 'RON',
      stockQuantity: 30,
      lastScraped: new Date(),
      priceHistory: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    mockRepository = {
      getSupplier: jest.fn(),
      getSupplierProducts: jest.fn(),
      createSupplierOrder: jest.fn(),
      getSupplierOrders: jest.fn(),
    } as unknown as jest.Mocked<ISupplierRepository>;

    useCase = new PlaceSupplierOrder(mockRepository);
  });

  it('should place supplier order successfully', async () => {
    mockRepository.getSupplier.mockResolvedValue(mockSupplier);
    mockRepository.getSupplierProducts.mockResolvedValue(mockProducts);
    mockRepository.createSupplierOrder.mockImplementation(async (order) => ({
      ...order,
      id: 123,
    }));

    const result = await useCase.execute(1, [
      { supplierSku: 'SKU-001', quantity: 10 },
      { supplierSku: 'SKU-002', quantity: 5 },
    ]);

    expect(result.orderId).toBe(123);
    expect(result.itemCount).toBe(2);
    expect(result.totalEstimate).toBe(2000);
    expect(result.currency).toBe('RON');
    expect(result.whatsappUrl).toContain('https://wa.me/+40711111111?text=');
    expect(mockRepository.createSupplierOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 1,
        status: SupplierOrderStatus.PENDING,
      }),
    );
  });

  it('should validate supplier exists', async () => {
    mockRepository.getSupplier.mockResolvedValue(null);

    await expect(
      useCase.execute(999, [{ supplierSku: 'SKU-001', quantity: 10 }]),
    ).rejects.toThrow(SupplierNotFoundError);
  });

  it('should validate items are provided', async () => {
    mockRepository.getSupplier.mockResolvedValue(mockSupplier);

    await expect(useCase.execute(1, [])).rejects.toThrow(InvalidOrderError);
  });

  it('should fail when SKU is missing from supplier catalog', async () => {
    mockRepository.getSupplier.mockResolvedValue(mockSupplier);
    mockRepository.getSupplierProducts.mockResolvedValue(mockProducts);

    await expect(
      useCase.execute(1, [{ supplierSku: 'SKU-999', quantity: 1 }]),
    ).rejects.toThrow(InvalidOrderError);
  });

  it('should fail when requested quantity exceeds stock', async () => {
    mockRepository.getSupplier.mockResolvedValue(mockSupplier);
    mockRepository.getSupplierProducts.mockResolvedValue(mockProducts);

    await expect(
      useCase.execute(1, [{ supplierSku: 'SKU-001', quantity: 999 }]),
    ).rejects.toThrow(InsufficientStockError);
  });

  it('should include passed orderId in created supplier order', async () => {
    mockRepository.getSupplier.mockResolvedValue(mockSupplier);
    mockRepository.getSupplierProducts.mockResolvedValue(mockProducts);
    mockRepository.createSupplierOrder.mockImplementation(async (order) => ({
      ...order,
      id: 124,
    }));

    await useCase.execute(1, [{ supplierSku: 'SKU-001', quantity: 2 }], 456);

    expect(mockRepository.createSupplierOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 456 }),
    );
  });

  it('should expose formatted order summaries via getOrders', async () => {
    const now = new Date();

    mockRepository.getSupplier.mockResolvedValue(mockSupplier);
    mockRepository.getSupplierOrders.mockResolvedValue([
      {
        id: 1,
        supplierId: 1,
        orderId: 456,
        items: [
          {
            supplierSku: 'SKU-001',
            internalSku: 'INT-001',
            productName: 'Product 1',
            quantity: 3,
            unitPrice: 100,
            totalPrice: 300,
          },
        ],
        status: SupplierOrderStatus.SENT,
        whatsappMessageTemplate: 'msg',
        sentAt: now,
        confirmedAt: null,
        deliveredAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const result = await useCase.getOrders(1);

    expect(result).toEqual([
      expect.objectContaining({
        id: 1,
        itemCount: 1,
        totalAmount: 300,
        status: SupplierOrderStatus.SENT,
      }),
    ]);
  });
});
