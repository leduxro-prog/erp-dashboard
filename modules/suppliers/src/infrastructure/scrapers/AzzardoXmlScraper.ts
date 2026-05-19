import { createModuleLogger } from '@shared/utils/logger';
import { parseSimpleXmlFeed } from '@shared/utils/simple-xml-feed';

import { SupplierCredentials } from '../../domain';
import { BaseScraper, ScrapedProduct } from './BaseScraper';

const logger = createModuleLogger('azzardo-xml-scraper');

const DEFAULT_AZZARDO_STOCK_XML_URL =
  'https://esb.torinodesign.com.pl/inventory/?warehouse=POZ&xml=1&';

export class AzzardoXmlScraper extends BaseScraper {
  constructor(browser?: any) {
    super('azzardo', browser);
  }

  async scrapeProducts(credentials: SupplierCredentials): Promise<ScrapedProduct[]> {
    return this.retry(async () => {
      const endpoint =
        credentials?.customHeader?.apiEndpoint ||
        process.env.AZZARDO_STOCK_XML_URL ||
        DEFAULT_AZZARDO_STOCK_XML_URL;

      const response = await fetch(endpoint, {
        headers: {
          Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (!response.ok) {
        throw new Error(`Azzardo XML feed error: ${response.status} ${response.statusText}`);
      }

      const xml = await response.text();
      const rows = parseSimpleXmlFeed(xml);

      logger.info(`Azzardo XML rows parsed: ${rows.length}`);

      return rows
        .filter((row) => row.sku)
        .map((row) => ({
          supplierSku: row.sku.trim().toUpperCase(),
          name: (row.name || row.sku).trim(),
          price: row.price && row.price > 0 ? row.price : 0,
          currency: 'RON',
          stockQuantity: row.quantity || 0,
        }));
    });
  }

  async scrapeStock(): Promise<{ sku: string; quantity: number }[]> {
    const products = await this.scrapeProducts({ username: '', password: '' });
    return products.map((p) => ({ sku: p.supplierSku, quantity: p.stockQuantity }));
  }
}
