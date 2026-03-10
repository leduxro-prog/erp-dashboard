import { SupplierCode, SupplierCredentials } from '../../domain';
import { ScrapedProduct as SupplierScrapedProduct } from '../../domain/ports/IScraper';
import { createModuleLogger } from '@shared/utils/logger';
import puppeteer, { Browser, Page } from 'puppeteer';
import { BaseScraper, ScrapedProduct } from './BaseScraper';

const logger = createModuleLogger('innpro-scraper');
const INNPRO_BASE_URL = 'https://b2b.innpro.ro';
const INNPRO_LOGIN_URL = `${INNPRO_BASE_URL}/signin.php`;

export class InnproScraper extends BaseScraper {
  constructor(browser?: any) {
    super(SupplierCode.INNPRO, browser);
  }

  async scrapeProducts(_credentials: SupplierCredentials): Promise<ScrapedProduct[]> {
    throw new Error('InnproScraper is not implemented yet. Use IOF importer flow.');
  }

  async scrapeProductsBySkus(
    credentials: SupplierCredentials,
    supplierSkus: string[],
  ): Promise<SupplierScrapedProduct[]> {
    const normalizedSkus = Array.from(
      new Set(
        supplierSkus
          .map((sku) => String(sku || '').trim())
          .filter((sku) => sku.length > 0),
      ),
    );

    if (normalizedSkus.length === 0) {
      return [];
    }

    return this.retry(async () => {
      let browser: Browser | null = null;
      let page: Page | null = null;

      try {
        if (!this.browser) {
          browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          });
          this.browser = browser;
        }

        page = await this.browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });
        await this.loginToPortal(page, credentials);

        const products: SupplierScrapedProduct[] = [];
        for (const sku of normalizedSkus) {
          const product = await this.scrapeSingleSku(page, sku);
          if (product) {
            products.push(product);
          }
        }

        return products;
      } finally {
        if (page) {
          await page.close().catch(() => undefined);
        }
        if (browser) {
          await browser.close().catch(() => undefined);
          this.browser = null;
        }
      }
    });
  }

  private async loginToPortal(page: Page, credentials: SupplierCredentials): Promise<void> {
    await this.navigateTo(page, INNPRO_LOGIN_URL);

    const usernameSelectors = ['#user_login', 'input[name="login"]'];
    const passwordSelectors = ['#user_pass', 'input[name="password"]'];
    const submitSelectors = ['button.signin_button', 'button[type="submit"]'];

    let usernameSelector: string | null = null;
    for (const selector of usernameSelectors) {
      if (await page.$(selector)) {
        usernameSelector = selector;
        break;
      }
    }

    let passwordSelector: string | null = null;
    for (const selector of passwordSelectors) {
      if (await page.$(selector)) {
        passwordSelector = selector;
        break;
      }
    }

    if (!usernameSelector || !passwordSelector) {
      throw new Error('Innpro login form not found');
    }

    await page.type(usernameSelector, credentials.username, { delay: 40 });
    await page.type(passwordSelector, credentials.password, { delay: 40 });

    let submitSelector: string | null = null;
    for (const selector of submitSelectors) {
      if (await page.$(selector)) {
        submitSelector = selector;
        break;
      }
    }

    if (!submitSelector) {
      throw new Error('Innpro login submit button not found');
    }

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: this.timeout }).catch(() => undefined),
      page.click(submitSelector),
    ]);
  }

  private async scrapeSingleSku(page: Page, sku: string): Promise<SupplierScrapedProduct | null> {
    const searchUrl = `${INNPRO_BASE_URL}/search.php?text=${encodeURIComponent(sku)}`;
    await this.navigateTo(page, searchUrl);

    const html = await page.content();
    const name =
      this.extractFirstText(html, [
        'h1',
        'a.product-name',
        '.product-name a',
        '.product-name',
        '.projector_name a',
        '.projector_name',
      ]) || undefined;
    const priceText =
      this.extractFirstText(html, ['.price', '.projector_price', '[class*="price"]']) || undefined;
    const stockText =
      this.extractFirstText(html, ['[class*="stock"]', '[class*="availability"]']) || undefined;

    const parsedPrice = this.parseMaybePrice(priceText);
    const parsedStock = this.parseMaybeStock(stockText);

    if (!name && parsedPrice === undefined && parsedStock === undefined) {
      logger.warn('Innpro fallback did not find data for SKU', { sku });
      return null;
    }

    return {
      supplierSku: sku,
      name: name || sku,
      price: parsedPrice ?? 0,
      currency: 'RON',
      stockQuantity: parsedStock,
    };
  }

  private extractFirstText(html: string, selectors: string[]): string | null {
    for (const selector of selectors) {
      const selectorEscaped = selector
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\[/g, '[')
        .replace(/\\\]/g, ']');

      const classNameMatch = selector.match(/^\.([a-zA-Z0-9_-]+)/);
      if (classNameMatch) {
        const className = classNameMatch[1];
        const regex = new RegExp(
          `<[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/[^>]+>`,
          'i',
        );
        const found = this.cleanText(regex.exec(html)?.[1]);
        if (found) {
          return found;
        }
      }

      const tagMatch = selector.match(/^[a-z0-9]+$/i);
      if (tagMatch) {
        const tag = selectorEscaped;
        const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
        const found = this.cleanText(regex.exec(html)?.[1]);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  private cleanText(raw: string | undefined): string | null {
    if (!raw) {
      return null;
    }

    const noTags = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return noTags.length > 0 ? noTags : null;
  }

  private parseMaybePrice(raw: string | undefined): number | undefined {
    if (!raw) {
      return undefined;
    }

    const normalized = raw.replace(',', '.');
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return undefined;
    }

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  private parseMaybeStock(raw: string | undefined): number | undefined {
    if (!raw) {
      return undefined;
    }

    const match = raw.match(/\d+/);
    if (!match) {
      return undefined;
    }

    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
  }
}
