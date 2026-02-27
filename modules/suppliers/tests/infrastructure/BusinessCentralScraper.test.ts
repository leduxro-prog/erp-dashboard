import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { SupplierCredentials } from '../../src/domain';
import { BusinessCentralScraper } from '../../src/infrastructure/scrapers/BusinessCentralScraper';

describe('BusinessCentralScraper', () => {
  let mockClient: { fetchInventoryRows: jest.Mock<any> };
  let scraper: BusinessCentralScraper;

  const credentials: SupplierCredentials = {
    username: 'client-id',
    password: 'client-secret',
  };

  beforeEach(() => {
    mockClient = {
      fetchInventoryRows: jest.fn(),
    };
    scraper = new BusinessCentralScraper(undefined, mockClient as any);
  });

  it('maps numeric inventory rows to scraped products', async () => {
    mockClient.fetchInventoryRows.mockResolvedValue([
      {
        No: 'ART-100',
        Description: 'Maytoni Spotlight',
        Inventory: 23,
        Unit_Price: 12.5,
        Currency_Code: 'EUR',
      },
    ]);

    const products = await scraper.scrapeProducts(credentials);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      supplierSku: 'ART-100',
      name: 'Maytoni Spotlight',
      stockQuantity: 23,
      price: 12.5,
      currency: 'EUR',
    });
  });

  it('falls back to tiered stock from status text when numeric stock is missing', async () => {
    mockClient.fetchInventoryRows.mockResolvedValue([
      {
        ItemNo: 'ART-LOW',
        Description: 'Low stock item',
        Availability: 'Limited',
        UnitPrice: '8.40',
      },
      {
        ItemNo: 'ART-HIGH',
        Description: 'Available item',
        StockStatus: 'Available',
        UnitPrice: 11,
      },
    ]);

    const products = await scraper.scrapeProducts(credentials);
    const bySku = new Map(products.map((p) => [p.supplierSku, p]));

    expect(bySku.get('ART-LOW')?.stockQuantity).toBe(5);
    expect(bySku.get('ART-HIGH')?.stockQuantity).toBe(40);
  });

  it('deduplicates by SKU and keeps highest stock', async () => {
    mockClient.fetchInventoryRows.mockResolvedValue([
      {
        No: 'ART-200',
        Description: 'First',
        Inventory: 1,
        Unit_Price: 0,
      },
      {
        No: 'ART-200',
        Description: 'Second',
        Inventory: 7,
        Unit_Price: 18,
      },
    ]);

    const products = await scraper.scrapeProducts(credentials);

    expect(products).toHaveLength(1);
    expect(products[0].supplierSku).toBe('ART-200');
    expect(products[0].stockQuantity).toBe(7);
    expect(products[0].price).toBe(18);
  });
});
