import puppeteer from 'puppeteer';
import { Page, Browser } from 'puppeteer';
import { BaseScraper, ScrapedProduct } from './BaseScraper';
import { SupplierCredentials } from '../../domain';
import { createModuleLogger } from '@shared/utils/logger';
import { translateSupplierProductName } from '@shared/utils/product-name-translator';

const logger = createModuleLogger('aca-lighting-scraper');

// Aca Lighting B2B URLs
const BASE_URL = 'https://acalight.gr';
const LOGIN_URL = `${BASE_URL}/en/cs-my-account/`;
const PRODUCT_BASE_URL = `${BASE_URL}/en/product-category/`;

// Product categories to scrape
const PRODUCT_CATEGORIES = [
  'fans/',
  'bulbs/',
  'lighting/',
  'wiring-device/',
  'electrical-equipment/',
  'energy-solutions/',
  'christmas-decoration/',
  'offers/',
];

export class AcaLightingScraper extends BaseScraper {
  constructor(browser?: any) {
    super('aca-lighting', browser);
  }

  async scrapeProducts(
    credentials: SupplierCredentials,
  ): Promise<ScrapedProduct[]> {
    return this.retry(async () => {
      let browser: Browser | null = null;
      let page: Page | null = null;

      try {
        // Launch browser if not provided
        if (!this.browser) {
          browser = await puppeteer.launch({
            headless: true,
            args: [
              '--no-sandbox',
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-web-security',
              '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ],
          });
          this.browser = browser;
        }

        // Create new page
        page = await this.browser.newPage();

        // Set viewport
        await page.setViewport({ width: 1920, height: 1080 });

        // Login to B2B portal
        await this.loginToPortal(page, credentials);

        // Scrape all products across categories
        const allProducts = await this.scrapeAllCategories(page);

        logger.info(`Scraped ${allProducts.length} products from Aca Lighting`);

        return allProducts;
      } catch (error) {
        logger.error('Aca Lighting scrape failed:', { error });
        throw new Error(
          `AcaLighting scrape failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      } finally {
        // Close the page but keep browser for reuse
        if (page) {
          try {
            await page.close();
          } catch (e) {
            // Ignore close errors
          }
        }
        // Only close browser if we launched it
        if (browser) {
          try {
            await browser.close();
          } catch (e) {
            // Ignore close errors
          }
        }
      }
    });
  }

  private async loginToPortal(
    page: Page,
    credentials: SupplierCredentials,
  ): Promise<void> {
    try {
      logger.info('Navigating to Aca Lighting login page...');

      // Navigate to login page
      await this.navigateTo(page, LOGIN_URL);

      // Wait for login form to load
      await this.waitForSelector(page, '#username');

      // Find the login form inputs
      // Try common selectors for WooCommerce login forms
      const usernameSelectors = [
        '#username',
        'input[name="username"]',
        '#user_login',
        'input[type="email"]',
      ];

      const passwordSelectors = [
        '#password',
        'input[name="password"]',
        '#user_pass',
        'input[type="password"]',
      ];

      const submitSelectors = [
        '#customer_login button[type="submit"]',
        'button[name="login"]',
        'button[type="submit"]:has-text("Log in")',
        'form.woocommerce-form-login button[type="submit"]',
      ];

      // Fill username
      let usernameFilled = false;
      for (const selector of usernameSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click({ clickCount: 3 }); // Select all existing text
            await element.type(credentials.username, { delay: 100 });
            usernameFilled = true;
            logger.info(`Filled username using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!usernameFilled) {
        throw new Error('Could not find username input field');
      }

      // Fill password
      let passwordFilled = false;
      for (const selector of passwordSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click({ clickCount: 3 });
            await element.type(credentials.password, { delay: 100 });
            passwordFilled = true;
            logger.info(`Filled password using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!passwordFilled) {
        throw new Error('Could not find password input field');
      }

      // Submit form - try multiple approaches
      let submitted = false;

      // First try to find and click submit button
      for (const selector of submitSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            await button.click();
            submitted = true;
            logger.info(`Clicked submit button using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      // If button not found, try to submit form via Enter key on password field
      if (!submitted) {
        await page.keyboard.press('Enter');
        submitted = true;
        logger.info('Submitted form via Enter key');
      }

      // Wait for navigation after login
      await this.delay(2000);

      // Check if login was successful by looking for signs of successful login
      // or error messages
      const currentUrl = page.url();
      logger.info(`Current URL after login attempt: ${currentUrl}`);

      // Check for error messages
      const errorSelectors = [
        '.woocommerce-error',
        '.woocommerce-message.error',
        '.login-error',
        '[role="alert"]',
      ];

      for (const selector of errorSelectors) {
        const errorElement = await page.$(selector);
        if (errorElement) {
          const errorText = await page.evaluate((el) => el.textContent, errorElement);
          if (errorText && errorText.trim()) {
            throw new Error(`Login error: ${errorText.trim()}`);
          }
        }
      }

      // Check for dashboard or my-account page (sign of successful login)
      const successIndicators = [
        'nav.woocommerce-MyAccount-navigation',
        '.woocommerce-MyAccount-content',
        '.woocommerce-MyAccount',
        'a[href*="customer-logout"]',
      ];

      let loginSuccess = false;
      for (const selector of successIndicators) {
        const element = await page.$(selector);
        if (element) {
          loginSuccess = true;
          logger.info(`Login successful - found indicator: ${selector}`);
          break;
        }
      }

      if (!loginSuccess) {
        // Check if URL changed to my-account
        if (currentUrl.includes('my-account') || currentUrl.includes('dashboard')) {
          loginSuccess = true;
        }
      }

      if (!loginSuccess) {
        // Check page content for "Hello" or "Dashboard" which appear after login
        const pageContent = await page.content();
        if (
          pageContent.includes('Hello') ||
          pageContent.includes('Dashboard') ||
          pageContent.includes('My Account')
        ) {
          loginSuccess = true;
        }
      }

      if (!loginSuccess) {
        throw new Error('Login failed - unable to verify successful authentication');
      }

      logger.info('Successfully logged in to Aca Lighting B2B portal');
    } catch (error) {
      throw new Error(
        `Aca Lighting login failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async scrapeAllCategories(page: Page): Promise<ScrapedProduct[]> {
    const allProducts: ScrapedProduct[] = [];
    const processedSkus = new Set<string>();

    logger.info('Starting to scrape all product categories...');

    for (const category of PRODUCT_CATEGORIES) {
      try {
        logger.info(`Scraping category: ${category}`);
        const categoryUrl = `${PRODUCT_BASE_URL}${category}`;

        const categoryProducts = await this.scrapeCategoryPage(
          page,
          categoryUrl,
          processedSkus,
        );

        allProducts.push(...categoryProducts);
        logger.info(`Found ${categoryProducts.length} products in ${category}`);

        // Small delay between categories to avoid rate limiting
        await this.delay(1000);
      } catch (error) {
        logger.warn(`Failed to scrape category ${category}:`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with next category
      }
    }

    logger.info(`Total unique products scraped: ${allProducts.length}`);
    return allProducts;
  }

  private async scrapeCategoryPage(
    page: Page,
    categoryUrl: string,
    processedSkus: Set<string>,
  ): Promise<ScrapedProduct[]> {
    const products: ScrapedProduct[] = [];
    let currentPage = 1;
    let hasMorePages = true;

    try {
      while (hasMorePages) {
        const pageUrl = currentPage === 1 ? categoryUrl : `${categoryUrl}page/${currentPage}/`;

        logger.info(`Scraping page ${currentPage}: ${pageUrl}`);

        await this.navigateTo(page, pageUrl);

        // Wait for products to load
        await this.delay(1000);

        // Try multiple selectors for WooCommerce products
        const productSelectors = [
          'li.product',
          '.product-item',
          '.product',
          '[class*="product"]',
        ];

        let productElements: any[] = [];
        for (const selector of productSelectors) {
          try {
            const elements = await page.$$(selector);
            if (elements && elements.length > 0) {
              productElements = elements;
              logger.info(`Found ${elements.length} products using selector: ${selector}`);
              break;
            }
          } catch (e) {
            // Try next selector
          }
        }

        if (productElements.length === 0) {
          logger.info(`No products found on page ${currentPage}`);
          hasMorePages = false;
          break;
        }

        // Extract product data from each element
        for (const element of productElements) {
          try {
            const product = await this.extractProductData(element);
            if (product && !processedSkus.has(product.supplierSku)) {
              processedSkus.add(product.supplierSku);
              products.push(product);
            }
          } catch (error) {
            logger.warn('Error extracting product data:', {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Check for pagination and next page
        hasMorePages = await this.hasNextPage(page);

        if (hasMorePages) {
          currentPage++;
          await this.delay(500);
        }
      }
    } catch (error) {
      logger.warn(`Error scraping category page ${categoryUrl}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return products;
  }

  private async extractProductData(
    element: any,
  ): Promise<ScrapedProduct | null> {
    try {
      // Extract product link and SKU from URL
      let productUrl = '';
      let sku = '';

      try {
        const linkElement = await element.$('a');
        if (linkElement) {
          productUrl = await (await element.getProperty('href')).jsonValue();
        }
      } catch (e) {
        // Ignore
      }

      // Extract SKU from URL or element data
      if (productUrl) {
        // Try to extract SKU from URL (WooCommerce often uses SKU in URL)
        const urlMatch = productUrl.match(/\/product\/([^\/]+)\/?$/);
        if (urlMatch) {
          sku = urlMatch[1].replace(/-/g, ' ').toUpperCase();
        }
      }

      // Try to get SKU from data attribute or specific element
      try {
        const skuElement = await element.$('.sku, .product-sku, [data-sku]');
        if (skuElement) {
            sku = await element.evaluate((el: any) => el.textContent?.trim(), skuElement);
        }
      } catch (e) {
        // Ignore
      }

      // Extract product name
      let name = '';
      const nameSelectors = [
        'h2.woocommerce-loop-product__title',
        'h3.product-title',
        '.product-title',
        'h2.product-name',
        'h3.product-name',
        '.wd-entities-title',
        'a.product-link h2',
        'a.product-link h3',
      ];

      for (const selector of nameSelectors) {
        try {
          const nameElement = await element.$(selector);
          if (nameElement) {
            name = await element.evaluate((el: any) => el.textContent?.trim(), nameElement);
            if (name) break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      // If no name found, try to get from link text
      if (!name) {
        try {
          const linkElement = await element.$('a');
          if (linkElement) {
            name = await element.evaluate(
              (el: any) => el.getAttribute('title') || el.textContent?.trim(),
              linkElement,
            );
          }
        } catch (e) {
          // Ignore
        }
      }

      // Use SKU as name fallback
      if (!name && sku) {
        name = sku;
      }

      if (!name) {
        return null; // Skip products without name
      }

      // Extract price
      let price = 0;
      const priceSelectors = [
        '.price',
        '.woocommerce-Price-amount',
        '.product-price',
        '.wd-product-price',
        'span.amount',
      ];

      for (const selector of priceSelectors) {
        try {
          const priceElement = await element.$(selector);
          if (priceElement) {
            const priceText = await element.evaluate((el: any) => el.textContent?.trim(), priceElement);
            price = this.parsePrice(priceText || '');
            if (price > 0) break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      // Extract stock information
      let stock = 0;
      const stockSelectors = [
        '.stock',
        '.product-stock',
        '.wd-stock-info',
        '.woocommerce-stock-availability',
      ];

      for (const selector of stockSelectors) {
        try {
          const stockElement = await element.$(selector);
          if (stockElement) {
            const stockText = await element.evaluate(
              (el: any) => el.textContent?.toLowerCase(),
              stockElement,
            );
            if (stockText?.includes('in stock') || stockText?.includes('disponibil')) {
              stock = 999; // High stock if "in stock"
            } else if (stockText?.includes('out of stock') || stockText?.includes('stoc epuizat')) {
              stock = 0;
            } else {
              stock = this.parseStock(stockText || '');
            }
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      // If no stock info found, assume available
      if (stock === 0) {
        stock = 999;
      }

      // If no price, skip product
      if (price <= 0) {
        logger.debug(`Skipping product without price: ${name}`);
        return null;
      }

      // Generate SKU if not found
      if (!sku) {
        sku = name
          .replace(/[^a-zA-Z0-9]/g, '')
          .substring(0, 20)
          .toUpperCase();
      }

      // Apply product name translation
      const translatedName = translateSupplierProductName(name);

      return {
        supplierSku: this.normalizeSku(sku),
        name: this.normalizeProductName(translatedName),
        price,
        currency: 'EUR', // Aca Lighting uses EUR
        stockQuantity: stock,
      };
    } catch (error) {
      logger.warn('Error in extractProductData:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  private async hasNextPage(page: Page): Promise<boolean> {
    try {
      // Check for pagination next link
      const nextSelectors = [
        'a.next',
        '.page-numbers .next',
        '.pagination .next',
        'a.page-numbers.next',
        '.wd-pagination .nav-links .next',
      ];

      for (const selector of nextSelectors) {
        try {
          const nextLink = await page.$(selector);
          if (nextLink) {
            const href = await page.evaluate((el) => el.getAttribute('href'), nextLink);
            if (href) {
              return true;
            }
          }
        } catch (e) {
          // Try next selector
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  async scrapeStock(): Promise<{ sku: string; quantity: number }[]> {
    const products = await this.scrapeProducts({ username: '', password: '' });
    return products.map((p) => ({ sku: p.supplierSku, quantity: p.stockQuantity }));
  }
}
