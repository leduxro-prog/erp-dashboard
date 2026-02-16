import { Browser, Page } from 'puppeteer';
import { SupplierCredentials } from '../../domain';
import { createModuleLogger } from '@shared/utils/logger';

const logger = createModuleLogger('base-scraper');

export interface ScrapedProduct {
  supplierSku: string;
  name: string;
  price: number;
  currency: string;
  stockQuantity: number;
}

export abstract class BaseScraper {
  protected readonly timeout: number = 30000; // 30 seconds
  protected readonly maxRetries: number = 3;
  protected supplierCode: string;
  protected browser: Browser | null = null;

  constructor(
    supplierCode: string,
    browser?: Browser,
  ) {
    this.supplierCode = supplierCode;
    if (browser) {
      this.browser = browser;
    }
  }

  abstract scrapeProducts(
    credentials: SupplierCredentials,
  ): Promise<ScrapedProduct[]>;

  async login(
    page: Page,
    loginUrl: string,
    credentials: SupplierCredentials,
    usernameSelector: string,
    passwordSelector: string,
    submitSelector: string,
  ): Promise<void> {
    try {
      await this.navigateTo(page, loginUrl);

      // Fill username
      await page.type(usernameSelector, credentials.username, {
        delay: 100,
      });

      // Fill password
      await page.type(passwordSelector, credentials.password, {
        delay: 100,
      });

      // Submit form
      await page.click(submitSelector);

      // Wait for navigation
      await page.waitForNavigation({
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });

      logger.info(`Logged in successfully to ${this.supplierCode}`);
    } catch (error) {
      throw new Error(
        `Login failed for ${this.supplierCode}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async navigateTo(page: Page, url: string): Promise<void> {
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.timeout,
      });
    } catch (error) {
      throw new Error(
        `Navigation failed to ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async waitForSelector(
    page: Page,
    selector: string,
  ): Promise<void> {
    try {
      await page.waitForSelector(selector, {
        timeout: this.timeout,
      });
    } catch (error) {
      throw new Error(
        `Selector not found: ${selector} within ${this.timeout}ms`,
      );
    }
  }

  async extractText(
    page: Page,
    selector: string,
  ): Promise<string> {
    try {
      const text = await page.$eval(selector, (el) => el.textContent || '');
      return text.trim();
    } catch (error) {
      throw new Error(
        `Failed to extract text from ${selector}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async extractAttribute(
    page: Page,
    selector: string,
    attribute: string,
  ): Promise<string> {
    try {
      const value = await page.$eval(
        selector,
        (el, attr) => el.getAttribute(attr),
        attribute,
      );
      return value || '';
    } catch (error) {
      throw new Error(
        `Failed to extract attribute ${attribute} from ${selector}`,
      );
    }
  }

  protected async retry<T>(
    fn: () => Promise<T>,
    attempt: number = 1,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (attempt < this.maxRetries) {
        logger.info(
          `Retry attempt ${attempt}/${this.maxRetries} for ${this.supplierCode}`,
        );

        // Exponential backoff
        await this.delay(1000 * Math.pow(2, attempt - 1));
        return this.retry(fn, attempt + 1);
      }

      throw error;
    }
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected parsePrice(priceString: string): number {
    // Remove currency symbols and commas
    const cleaned = priceString.replace(/[^\d.,-]/g, '');

    // Handle different decimal separators
    // Check if there's a comma and period
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // European format: 1.234,56
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
      }
      // US format: 1,234.56
      return parseFloat(cleaned.replace(/,/g, ''));
    }

    // If only comma exists
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      // Likely European format if comma is at the end with 2 digits
      if (parts[parts.length - 1].length === 2) {
        return parseFloat(cleaned.replace(',', '.'));
      }
      // US format
      return parseFloat(cleaned.replace(/,/g, ''));
    }

    return parseFloat(cleaned);
  }

  protected parseStock(stockString: string): number {
    const cleaned = stockString.replace(/[^\d]/g, '');
    return parseInt(cleaned, 10) || 0;
  }

  protected normalizeSku(sku: string): string {
    return sku.trim().toUpperCase();
  }

  protected normalizeProductName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }
}
