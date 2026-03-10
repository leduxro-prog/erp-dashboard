import { describe, expect, it, jest } from '@jest/globals';
import puppeteer from 'puppeteer';

import { SupplierCode } from '../../src/domain';
import { ScraperFactory } from '../../src/infrastructure/scrapers/ScraperFactory';
import { InnproScraper } from '../../src/infrastructure/scrapers/InnproScraper';

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(),
  },
}));

describe('ScraperFactory', () => {
  it('returns InnproScraper for innpro supplier code', () => {
    const factory = new ScraperFactory();

    const scraper = factory.getScraper(SupplierCode.INNPRO);

    expect(scraper).toBeInstanceOf(InnproScraper);
  });

  it('fails fast when Innpro scraper implementation is missing', async () => {
    const scraper = new InnproScraper();

    await expect(
      scraper.scrapeProducts({ username: 'user', password: 'pass' }),
    ).rejects.toThrow('InnproScraper is not implemented yet');
  });

  it('returns empty array for empty targeted sku list', async () => {
    const scraper = new InnproScraper();

    await expect(
      scraper.scrapeProductsBySkus({ username: 'user', password: 'pass' }, []),
    ).resolves.toEqual([]);
  });

  it('retries with a fresh browser if first attempt fails', async () => {
    const launchMock = (puppeteer as any).launch as any;

    const browserOne: any = {
      newPage: jest.fn(async () => {
        throw new Error('first attempt failed');
      }),
      close: jest.fn(async () => undefined),
    };

    const page: any = {
      setViewport: jest.fn(async () => undefined),
      close: jest.fn(async () => undefined),
    };

    const browserTwo: any = {
      newPage: jest.fn(async () => page),
      close: jest.fn(async () => undefined),
    };

    launchMock
      .mockImplementationOnce(async () => browserOne)
      .mockImplementationOnce(async () => browserTwo);

    const scraper = new InnproScraper();
    jest.spyOn(scraper as any, 'loginToPortal').mockResolvedValue(undefined);
    jest.spyOn(scraper as any, 'scrapeSingleSku').mockResolvedValue({
      supplierSku: 'SKU-1',
      name: 'Fallback Name',
      price: 10,
      currency: 'RON',
      stockQuantity: 2,
    });

    const result = await scraper.scrapeProductsBySkus(
      { username: 'user', password: 'pass' },
      ['SKU-1'],
    );

    expect(launchMock).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1);
  });
});
