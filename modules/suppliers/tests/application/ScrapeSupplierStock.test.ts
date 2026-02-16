import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ScrapeSupplierStock } from '../../src/application/use-cases/ScrapeSupplierStock';
import { ISupplierRepository } from '../../src/domain';
import { SupplierCode, SupplierEntity } from '../../src/domain/entities/Supplier';
import { IScraperFactory } from '../../src/domain/ports/IScraper';
import {
  ScrapeError,
  SupplierNotFoundError,
} from '../../src/application/errors/supplier.errors';

describe('ScrapeSupplierStock', () => {
  let useCase: ScrapeSupplierStock;
  let mockRepository: jest.Mocked<ISupplierRepository>;
  let mockScraperFactory: jest.Mocked<IScraperFactory>;

  const mockSupplier = new SupplierEntity({
    id: 1,
    name: 'Test Supplier',
    code: SupplierCode.ACA_LIGHTING,
    website: 'https://supplier.test',
    contactEmail: 'test@supplier.test',
    contactPhone: '+40111111111',
    whatsappNumber: '+40111111111',
    productCount: 100,
    isActive: true,
    credentials: {
      username: 'test',
      password: 'test',
    },
    syncFrequency: 4,
    lastSync: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const scrapedProducts = [
    {
      supplierSku: 'TEST-001',
      name: 'Test Product',
      price: 10,
      currency: 'USD',
      stockQuantity: 100,
    },
  ];

  beforeEach(() => {
    mockRepository = {
      getSupplier: jest
        .fn<ISupplierRepository['getSupplier']>()
        .mockImplementation(async () => mockSupplier),
      getSupplierProducts: jest
        .fn<ISupplierRepository['getSupplierProducts']>()
        .mockImplementation(async () => []),
      bulkUpsertProducts: jest
        .fn<ISupplierRepository['bulkUpsertProducts']>()
        .mockImplementation(async () => ({ created: 0, updated: 0 })),
      updateLastSync: jest
        .fn<ISupplierRepository['updateLastSync']>()
        .mockImplementation(async () => undefined),
      listSuppliers: jest
        .fn<ISupplierRepository['listSuppliers']>()
        .mockImplementation(async () => [mockSupplier]),
    } as unknown as jest.Mocked<ISupplierRepository>;

    mockScraperFactory = {
      getScraper: jest.fn<IScraperFactory['getScraper']>().mockImplementation(
        () => ({
          scrapeProducts: async () => scrapedProducts,
          scrapeStock: async () => [],
        }),
      ),
    } as unknown as jest.Mocked<IScraperFactory>;

    useCase = new ScrapeSupplierStock(mockRepository, mockScraperFactory);
  });

  it('throws SupplierNotFoundError for unknown supplier', async () => {
    mockRepository.getSupplier.mockImplementationOnce(async () => null);

    await expect(useCase.execute(999)).rejects.toThrow(SupplierNotFoundError);
  });

  it('wraps inactive supplier validation in ScrapeError', async () => {
    mockRepository.getSupplier.mockImplementationOnce(
      async () => new SupplierEntity({ ...mockSupplier, isActive: false }),
    );

    const execution = useCase.execute(1);

    await expect(execution).rejects.toThrow(ScrapeError);
    await expect(execution).rejects.toThrow('not active');
  });

  it('scrapes products successfully and returns aggregate counters', async () => {
    const result = await useCase.execute(1);

    expect(result.success).toBe(true);
    expect(result.supplierId).toBe(1);
    expect(result.productsFound).toBe(1);
    expect(result.productsCreated).toBe(1);
    expect(result.productsUpdated).toBe(0);
  });

  it('detects updates for already known supplier SKUs', async () => {
    mockRepository.getSupplierProducts.mockImplementationOnce(async () => [
      {
        id: 1,
        supplierId: 1,
        supplierSku: 'TEST-001',
        name: 'Test Product',
        price: 10,
        currency: 'USD',
        stockQuantity: 50,
        lastScraped: new Date(),
        priceHistory: [{ price: 10, date: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await useCase.execute(1);

    expect(result.productsCreated).toBe(0);
    expect(result.productsUpdated).toBe(1);
  });

  it('captures price changes and significant changes separately', async () => {
    mockRepository.getSupplierProducts.mockImplementationOnce(async () => [
      {
        id: 1,
        supplierId: 1,
        supplierSku: 'TEST-001',
        name: 'Test Product',
        price: 100,
        currency: 'USD',
        stockQuantity: 100,
        lastScraped: new Date(),
        priceHistory: [{ price: 100, date: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    mockScraperFactory.getScraper.mockImplementationOnce(() => ({
      scrapeProducts: async () => [
        {
          supplierSku: 'TEST-001',
          name: 'Test Product',
          price: 125,
          currency: 'USD',
          stockQuantity: 100,
        },
      ],
      scrapeStock: async () => [],
    }));

    const result = await useCase.execute(1);

    expect(result.priceChanges).toHaveLength(1);
    expect(result.priceChanges[0].changePercentage).toBe(25);
    expect(result.significantPriceChanges).toHaveLength(1);
  });

  it('updates supplier last sync timestamp', async () => {
    await useCase.execute(1);

    expect(mockRepository.updateLastSync).toHaveBeenCalledWith(
      1,
      expect.any(Date),
    );
  });

  it('emits scrape:complete after successful execution', async () => {
    const listener = jest.fn();
    useCase.on('scrape:complete', listener);

    await useCase.execute(1);

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        supplier: 'Test Supplier',
        result: expect.objectContaining({ success: true }),
      }),
    );
  });

  it('wraps scraper failures in ScrapeError', async () => {
    mockScraperFactory.getScraper.mockImplementationOnce(() => ({
      scrapeProducts: async () => {
        throw new Error('Scraper failed');
      },
      scrapeStock: async () => [],
    }));

    await expect(useCase.execute(1)).rejects.toThrow(ScrapeError);
  });

  it('executeAll processes all active suppliers and continues on failures', async () => {
    const secondSupplier = new SupplierEntity({
      ...mockSupplier,
      id: 2,
      name: 'Second Supplier',
    });

    mockRepository.listSuppliers.mockImplementationOnce(
      async () => [mockSupplier, secondSupplier],
    );
    mockRepository.getSupplier.mockImplementation(async (id) =>
      id === 1 ? mockSupplier : secondSupplier,
    );

    let calls = 0;
    mockScraperFactory.getScraper.mockImplementation(() => ({
      scrapeProducts: async () => {
        calls += 1;
        if (calls === 1) {
          throw new Error('first failed');
        }
        return scrapedProducts;
      },
      scrapeStock: async () => [],
    }));

    const results = await useCase.executeAll();

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });
});
