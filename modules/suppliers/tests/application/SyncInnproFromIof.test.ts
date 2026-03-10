import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { ScrapeError } from '../../src/application/errors/supplier.errors';
import { SyncInnproFromIof } from '../../src/application/use-cases/SyncInnproFromIof';
import { ISupplierRepository } from '../../src/domain';
import { SupplierCode, SupplierEntity } from '../../src/domain/entities/Supplier';
import { InnproIofClient } from '../../src/infrastructure/iof/InnproIofClient';
import { InnproIofParser } from '../../src/infrastructure/iof/InnproIofParser';
import { InnproScraper } from '../../src/infrastructure/scrapers/InnproScraper';

describe('SyncInnproFromIof', () => {
  let useCase: SyncInnproFromIof;
  let mockRepository: jest.Mocked<ISupplierRepository>;
  let mockClient: jest.Mocked<InnproIofClient>;
  let mockParser: jest.Mocked<InnproIofParser>;
  let mockScraper: jest.Mocked<Pick<InnproScraper, 'scrapeProductsBySkus'>>;

  const innproSupplier = new SupplierEntity({
    id: 44,
    name: 'Innpro',
    code: SupplierCode.INNPRO,
    website: 'https://innpro.ro',
    contactEmail: 'office@innpro.ro',
    contactPhone: '',
    whatsappNumber: '',
    productCount: 0,
    isActive: true,
    credentials: {
      username: 'api-user',
      password: 'api-pass',
      customHeader: { apiEndpoint: 'https://iof.test/gateway.xml' },
    },
    syncFrequency: 4,
    defaultMarkupPercentage: 60,
    markupType: 'percentage',
    lastSync: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    mockRepository = {
      getSupplier: jest.fn<ISupplierRepository['getSupplier']>().mockImplementation(async () => innproSupplier),
      getSupplierProducts: jest.fn<ISupplierRepository['getSupplierProducts']>().mockImplementation(async () => []),
      bulkUpsertProducts: jest
        .fn<ISupplierRepository['bulkUpsertProducts']>()
        .mockImplementation(async () => ({ created: 0, updated: 0 })),
      updateLastSync: jest.fn<ISupplierRepository['updateLastSync']>().mockImplementation(async () => undefined),
      getSupplierPricingRule: jest
        .fn<ISupplierRepository['getSupplierPricingRule']>()
        .mockImplementation(async () => null),
      upsertProductSpecifications: jest
        .fn<ISupplierRepository['upsertProductSpecifications']>()
        .mockImplementation(async (specs) => specs.length),
    } as unknown as jest.Mocked<ISupplierRepository>;

    mockClient = {
      readGateway: jest.fn<InnproIofClient['readGateway']>().mockImplementation(async () => '<gateway />'),
      readFeed: jest.fn<InnproIofClient['readFeed']>().mockImplementation(async (url: string) => `<feed>${url}</feed>`),
    } as unknown as jest.Mocked<InnproIofClient>;

    mockParser = {
      parseGateway: jest.fn<InnproIofParser['parseGateway']>().mockImplementation(() => ({
        full: 'https://iof.test/full.xml',
        light: 'https://iof.test/light.xml',
        fullChange: 'https://iof.test/full_change.xml',
      })),
      parseProducts: jest.fn<InnproIofParser['parseProducts']>().mockImplementation((raw: string) => {
        if (raw.includes('full.xml')) {
          return [
            {
              supplierSku: 'SKU-1',
              name: 'zasilacz led 12W',
              price: 110,
              currency: 'RON',
              stockQuantity: 4,
              category: 'Lighting',
              imageUrl: 'https://cdn.innpro.test/SKU-1-full.jpg',
              images: [
                'https://cdn.innpro.test/SKU-1-full.jpg',
                'https://cdn.innpro.test/SKU-1-full-2.jpg',
              ],
              specifications: {
                wattage: 12,
                ipRating: 'IP65',
                customSpecs: {
                  description: 'Full feed product description',
                },
              },
            },
            {
              supplierSku: 'SKU-2',
              name: 'Product Two',
              price: 10,
              currency: 'RON',
              stockQuantity: 1,
              category: 'Lighting',
            },
          ];
        }

        if (raw.includes('light.xml')) {
          return [
            {
              supplierSku: 'SKU-1',
              name: 'zasilacz led 12W',
              price: 110,
              currency: 'RON',
              stockQuantity: 9,
              category: 'Lighting',
              imageUrl: 'https://cdn.innpro.test/SKU-1-light.jpg',
            },
          ];
        }

        if (raw.includes('full_change.xml')) {
          return [
            {
              supplierSku: 'SKU-2',
              name: 'Product Two',
              price: 12,
              currency: 'RON',
              stockQuantity: 1,
              category: 'Lighting',
            },
          ];
        }

        return [];
      }),
    } as unknown as jest.Mocked<InnproIofParser>;

    mockScraper = {
      scrapeProductsBySkus: jest.fn<InnproScraper['scrapeProductsBySkus']>().mockImplementation(async () => []),
    };

    useCase = new SyncInnproFromIof(
      mockRepository,
      mockClient,
      mockParser,
      undefined,
      mockScraper as unknown as InnproScraper,
    );
  });

  it('reads gateway/full/light/full_change and merges by supplier SKU', async () => {
    mockRepository.getSupplierProducts.mockImplementationOnce(async () => [
      {
        id: 1,
        supplierId: innproSupplier.id,
        supplierSku: 'SKU-1',
        name: 'Old Product One',
        price: 100,
        currency: 'RON',
        stockQuantity: 2,
        lastScraped: new Date(),
        priceHistory: [{ price: 100, date: new Date() }],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const result = await useCase.execute(innproSupplier.id);

    expect(mockClient.readGateway).toHaveBeenCalledTimes(1);
    expect(mockClient.readFeed).toHaveBeenCalledWith('https://iof.test/full.xml', innproSupplier.credentials);
    expect(mockClient.readFeed).toHaveBeenCalledWith('https://iof.test/light.xml', innproSupplier.credentials);
    expect(mockClient.readFeed).toHaveBeenCalledWith('https://iof.test/full_change.xml', innproSupplier.credentials);
    expect(result.productsFound).toBe(2);
    expect(result.productsUpdated).toBe(1);
    expect(result.productsCreated).toBe(1);
    expect(result.priceChanges).toHaveLength(1);
    expect(result.priceChanges[0].supplierSku).toBe('SKU-1');

    const upsertPayload = mockRepository.bulkUpsertProducts.mock.calls[0]?.[0] || [];
    const sku1 = upsertPayload.find((row) => row.supplierSku === 'SKU-1');
    const sku2 = upsertPayload.find((row) => row.supplierSku === 'SKU-2');

    expect(sku1?.stockQuantity).toBe(9);
    expect(sku1?.imageUrl).toBe('https://cdn.innpro.test/SKU-1-light.jpg');
    expect(String(sku1?.name || '')).toContain('sursa de alimentare');
    expect(sku1?.markupPercentage).toBe(60);
    expect(sku1?.sellingPrice).toBe(176);
    expect(sku2?.price).toBe(12);

    expect(mockRepository.upsertProductSpecifications).toHaveBeenCalledTimes(1);
    const specsPayload = mockRepository.upsertProductSpecifications.mock.calls[0]?.[0] || [];
    const sku1Spec = specsPayload.find((row) => row.supplierSku === 'SKU-1');
    expect(sku1Spec?.wattage).toBe(12);
    expect(sku1Spec?.ipRating).toBe('IP65');
    expect(sku1Spec?.customSpecs?.description).toBe('Full feed product description');
    expect(sku1Spec?.customSpecs?.imageGallery).toEqual([
      'https://cdn.innpro.test/SKU-1-full.jpg',
      'https://cdn.innpro.test/SKU-1-full-2.jpg',
      'https://cdn.innpro.test/SKU-1-light.jpg',
    ]);
    expect(result.specificationsDetected).toBeGreaterThan(0);
    expect(result.specificationsUpdated).toBeGreaterThan(0);
  });

  it('wraps IOF failures in ScrapeError', async () => {
    mockClient.readGateway.mockImplementationOnce(async () => {
      throw new Error('Gateway offline');
    });

    const execution = useCase.execute(innproSupplier.id);

    await expect(execution).rejects.toThrow(ScrapeError);
    await expect(execution).rejects.toThrow('Gateway offline');
  });

  it('does not clobber stock when delta feed omits stockQuantity', async () => {
    mockParser.parseProducts.mockImplementation((raw: string) => {
      if (raw.includes('full.xml')) {
        return [
          {
            supplierSku: 'SKU-1',
            name: 'Product One',
            price: 110,
            currency: 'RON',
            stockQuantity: 4,
            category: 'Lighting',
          },
        ];
      }

      if (raw.includes('light.xml')) {
        return [
          {
            supplierSku: 'SKU-1',
            name: 'Product One',
            price: 112,
            currency: 'RON',
            category: 'Lighting',
          },
        ];
      }

      return [];
    });

    await useCase.execute(innproSupplier.id);

    const upsertPayload = mockRepository.bulkUpsertProducts.mock.calls[0]?.[0] || [];
    const sku1 = upsertPayload.find((row) => row.supplierSku === 'SKU-1');
    expect(sku1?.stockQuantity).toBe(4);
    expect(sku1?.price).toBe(112);
  });

  it('continues sync when optional light/full_change feed fails', async () => {
    mockClient.readFeed.mockImplementation(async (url: string) => {
      if (url.includes('light.xml')) {
        throw new Error('Light feed timeout');
      }

      return `<feed>${url}</feed>`;
    });

    const result = await useCase.execute(innproSupplier.id);

    expect(result.success).toBe(true);
    expect(result.productsFound).toBeGreaterThan(0);
    expect(mockRepository.bulkUpsertProducts).toHaveBeenCalled();
  });

  it('uses gateway payload as full feed when gateway URLs are unavailable', async () => {
    innproSupplier.credentials = {
      ...innproSupplier.credentials,
      customHeader: {
        apiEndpoint:
          'https://b2b.innpro.ro/edi/export-offer.php?client=ledux&language=rum&token=test&shop=16&type=full&format=xml&iof_3_0',
      },
    };

    mockClient.readGateway.mockImplementationOnce(async () => '<offer><products><product><sku>SKU-DIRECT</sku><name>Direct Feed Product</name><price>99</price><currency>RON</currency><stock>3</stock></product></products></offer>');
    mockParser.parseGateway.mockImplementationOnce(() => ({}));
    mockParser.parseProducts.mockImplementation((raw: string) => {
      if (raw.includes('<offer>')) {
        return [
          {
            supplierSku: 'SKU-DIRECT',
            name: 'Direct Feed Product',
            price: 99,
            currency: 'RON',
            stockQuantity: 3,
            category: 'Lighting',
          },
        ];
      }

      return [];
    });

    const result = await useCase.execute(innproSupplier.id);

    expect(result.success).toBe(true);
    expect(result.productsFound).toBe(1);
    expect(mockRepository.bulkUpsertProducts).toHaveBeenCalled();
    const feedUrls = mockClient.readFeed.mock.calls.map((call) => call[0]);
    expect(feedUrls.some((url) => String(url).includes('type=light'))).toBe(true);
    expect(feedUrls.some((url) => String(url).includes('type=full_change'))).toBe(true);
  });

  it('runs targeted fallback scraping only for affected SKUs and merges fallback fields', async () => {
    mockParser.parseProducts.mockImplementation((raw: string) => {
      if (raw.includes('full.xml')) {
        return [
          {
            supplierSku: 'SKU-MISSING',
            name: 'IOF Name',
            price: 0,
            currency: 'RON',
            category: 'Lighting',
          },
          {
            supplierSku: 'SKU-OK',
            name: 'Already Complete',
            price: 21,
            currency: 'RON',
            stockQuantity: 5,
            category: 'Lighting',
          },
        ];
      }

      return [];
    });

    mockScraper.scrapeProductsBySkus.mockImplementation(async () => [
      {
        supplierSku: 'SKU-MISSING',
        name: 'Fallback Product',
        price: 33,
        currency: 'RON',
        stockQuantity: 8,
      },
    ]);

    await useCase.execute(innproSupplier.id);

    expect(mockScraper.scrapeProductsBySkus).toHaveBeenCalledTimes(1);
    expect(mockScraper.scrapeProductsBySkus).toHaveBeenCalledWith(innproSupplier.credentials, ['SKU-MISSING']);

    const upsertPayload = mockRepository.bulkUpsertProducts.mock.calls[0]?.[0] || [];
    const skuMissing = upsertPayload.find((row) => row.supplierSku === 'SKU-MISSING');
    const skuOk = upsertPayload.find((row) => row.supplierSku === 'SKU-OK');

    expect(skuMissing?.name).toBe('IOF Name');
    expect(skuMissing?.price).toBe(33);
    expect(skuMissing?.stockQuantity).toBe(8);
    expect(skuOk?.price).toBe(21);
    expect(skuOk?.stockQuantity).toBe(5);
  });

  it('keeps sync successful when targeted fallback scraping fails', async () => {
    mockParser.parseProducts.mockImplementation((raw: string) => {
      if (raw.includes('full.xml')) {
        return [
          {
            supplierSku: 'SKU-MISSING',
            name: '',
            price: 0,
            currency: 'RON',
            category: 'Lighting',
          },
        ];
      }

      return [];
    });

    mockScraper.scrapeProductsBySkus.mockImplementation(async () => {
      throw new Error('Fallback endpoint unavailable');
    });

    const result = await useCase.execute(innproSupplier.id);

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.productsFound).toBe(1);
    expect(mockRepository.bulkUpsertProducts).toHaveBeenCalled();
  });
});
