import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { MapSku } from '../../src/application/use-cases/MapSku';
import { ISupplierRepository } from '../../src/domain';
import {
  InvalidSkuMappingError,
  SkuMappingAlreadyExistsError,
  SupplierNotFoundError,
} from '../../src/application/errors/supplier.errors';
import { SupplierCode } from '../../src/domain/entities/Supplier';

describe('MapSku Use Case', () => {
  let useCase: MapSku;
  let mockRepository: jest.Mocked<ISupplierRepository>;

  const mockSupplier = {
    id: 1,
    name: 'Supplier 1',
    code: SupplierCode.ACA_LIGHTING,
    website: 'https://supplier.test',
    contactEmail: 'contact@supplier.test',
    contactPhone: '+40111111111',
    whatsappNumber: '+40111111111',
    productCount: 10,
    isActive: true,
    credentials: { username: 'u', password: 'p' },
    syncFrequency: 4,
    lastSync: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMapping = {
    id: 1,
    supplierId: 1,
    supplierSku: 'SUP-001',
    internalProductId: 10,
    internalSku: 'INT-001',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepository = {
      getSupplier: jest.fn(),
      getSkuMapping: jest.fn(),
      getSkuMappings: jest.fn(),
      createSkuMapping: jest.fn(),
      updateSkuMapping: jest.fn(),
      deleteSkuMapping: jest.fn(),
    } as unknown as jest.Mocked<ISupplierRepository>;

    useCase = new MapSku(mockRepository);
  });

  it('should create SKU mapping', async () => {
    mockRepository.getSupplier.mockResolvedValue(mockSupplier);
    mockRepository.getSkuMapping.mockResolvedValue(null);
    mockRepository.createSkuMapping.mockResolvedValue(mockMapping);

    const result = await useCase.create(1, 'SUP-001', 10, 'INT-001');

    expect(result).toEqual(mockMapping);
    expect(mockRepository.createSkuMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 1,
        supplierSku: 'SUP-001',
        internalProductId: 10,
        internalSku: 'INT-001',
      }),
    );
  });

  it('should validate internal SKU is not empty', async () => {
    await expect(useCase.create(1, 'SUP-001', 10, '')).rejects.toThrow(
      InvalidSkuMappingError,
    );
  });

  it('should validate supplier SKU is not empty', async () => {
    await expect(useCase.create(1, '', 10, 'INT-001')).rejects.toThrow(
      InvalidSkuMappingError,
    );
  });

  it('should validate supplier and internal product IDs are provided', async () => {
    await expect(useCase.create(0, 'SUP-001', 10, 'INT-001')).rejects.toThrow(
      InvalidSkuMappingError,
    );
    await expect(useCase.create(1, 'SUP-001', 0, 'INT-001')).rejects.toThrow(
      InvalidSkuMappingError,
    );
  });

  it('should fail when supplier does not exist', async () => {
    mockRepository.getSupplier.mockResolvedValue(null);

    await expect(useCase.create(1, 'SUP-001', 10, 'INT-001')).rejects.toThrow(
      SupplierNotFoundError,
    );
  });

  it('should fail when mapping already exists', async () => {
    mockRepository.getSupplier.mockResolvedValue(mockSupplier);
    mockRepository.getSkuMapping.mockResolvedValue(mockMapping);

    await expect(useCase.create(1, 'SUP-001', 10, 'INT-001')).rejects.toThrow(
      SkuMappingAlreadyExistsError,
    );
  });

  it('should retrieve SKU mapping', async () => {
    mockRepository.getSkuMapping.mockResolvedValue(mockMapping);

    const result = await useCase.getMapping(1, 'SUP-001');

    expect(result).toEqual(
      expect.objectContaining({
        id: 1,
        supplierId: 1,
        supplierSku: 'SUP-001',
        internalSku: 'INT-001',
      }),
    );
  });

  it('should delete SKU mapping', async () => {
    await useCase.deleteMapping(1);

    expect(mockRepository.deleteSkuMapping).toHaveBeenCalledWith(1);
  });

  it('should trim whitespace from SKUs when creating mapping', async () => {
    mockRepository.getSupplier.mockResolvedValue(mockSupplier);
    mockRepository.getSkuMapping.mockResolvedValue(null);
    mockRepository.createSkuMapping.mockResolvedValue(mockMapping);

    await useCase.create(1, '  SUP-001  ', 10, '  INT-001  ');

    expect(mockRepository.createSkuMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierSku: 'SUP-001',
        internalSku: 'INT-001',
      }),
    );
  });
});
