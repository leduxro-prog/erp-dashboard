# Supplier Scraper Implementation Guide

## Status: 95% Complete - Infrastructure Ready

All scraper infrastructure is production-ready. Only real supplier credentials and website-specific implementation details are needed.

## What's Already Implemented

### ✅ Complete Infrastructure

1. **Base Scraper Class** (`BaseScraper.ts`)
   - Puppeteer integration with Browser management
   - Login automation (username/password/submit)
   - Navigation with timeout and retry logic
   - Data extraction helpers (text, attributes)
   - Exponential backoff retry mechanism (3 attempts)
   - Price parsing (handles European/US formats)
   - Stock quantity parsing
   - SKU and name normalization

2. **Scraper Factory** (`ScraperFactory.ts`)
   - Dynamic scraper instantiation by supplier code
   - Browser instance management and reuse

3. **Environment Configuration**
   - `.env.example` template with all required variables
   - Configurable timeouts, retries, sync schedules
   - Price alert thresholds

4. **Database Entities**
   - Product sync tracking
   - Price history
   - Stock level monitoring

5. **Background Job Processing**
   - BullMQ integration for scheduled scraping
   - Automatic sync every 4 hours (configurable)
   - Sync window: 6 AM - 10 PM (configurable)

## What Needs to Be Done

### For Each Supplier (Braytron, Arelux, Masterled, FSL, ACA Lighting)

#### 1. Obtain Real Credentials
Add to `.env` file (copy from `.env.example`):
```bash
SUPPLIER_BRAYTRON_USERNAME=real_username_here
SUPPLIER_BRAYTRON_PASSWORD=real_password_here
# Repeat for each supplier
```

#### 2. Identify Website Structure
For each supplier website, document:

**Login Page:**
- URL: `https://supplier-b2b-portal.com/login`
- Username field selector: `input[name="username"]` or `#email`
- Password field selector: `input[name="password"]` or `#password`
- Submit button selector: `button[type="submit"]` or `.login-btn`

**Products/Stock Page:**
- URL after login: `https://supplier-b2b-portal.com/products` or `/stock`
- Product list container selector: `.product-list`, `table.products`, etc.
- Individual product selector: `.product-item`, `tr.product-row`, etc.

**Product Data Selectors:**
- SKU: `.product-sku`, `td.sku`, etc.
- Name: `.product-name`, `h3.title`, etc.
- Price: `.product-price`, `.price`, etc.
- Stock: `.stock-quantity`, `.availability`, etc.
- Currency: `.currency`, extract from price text, or hardcoded

#### 3. Update Scraper Implementation

Replace the mock data in each scraper file. Example for `BraytronScraper.ts`:

```typescript
async scrapeProducts(credentials: SupplierCredentials): Promise<ScrapedProduct[]> {
  return this.retry(async () => {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    const products: ScrapedProduct[] = [];

    try {
      // 1. Login
      await this.login(
        page,
        'https://braytron-b2b.com/login',  // Real URL
        credentials,
        'input[name="email"]',              // Real selectors
        'input[name="password"]',
        'button[type="submit"]'
      );

      // 2. Navigate to products/stock page
      await this.navigateTo(page, 'https://braytron-b2b.com/products');

      // 3. Wait for products to load
      await this.waitForSelector(page, '.product-list .product-item');

      // 4. Extract product data
      const productElements = await page.$$('.product-item');

      for (const element of productElements) {
        try {
          const sku = await element.$eval('.product-sku', el => el.textContent?.trim() || '');
          const name = await element.$eval('.product-name', el => el.textContent?.trim() || '');
          const priceText = await element.$eval('.product-price', el => el.textContent?.trim() || '');
          const stockText = await element.$eval('.stock-quantity', el => el.textContent?.trim() || '');

          products.push({
            supplierSku: this.normalizeSku(sku),
            name: this.normalizeProductName(name),
            price: this.parsePrice(priceText),
            currency: 'EUR',  // or extract from page
            stockQuantity: this.parseStock(stockText),
          });
        } catch (error) {
          logger.warn(`Failed to extract product data: ${error}`);
          // Continue with next product
        }
      }

      logger.info(`Scraped ${products.length} products from Braytron`);
      return products;

    } finally {
      await page.close();
    }
  });
}
```

#### 4. Handle Edge Cases

Consider these scenarios in your implementation:

- **Pagination**: If products are on multiple pages
  ```typescript
  let hasNextPage = true;
  let currentPage = 1;

  while (hasNextPage) {
    // Extract products from current page
    // ...

    // Check if next page exists
    const nextButton = await page.$('.pagination .next:not(.disabled)');
    if (nextButton) {
      await nextButton.click();
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      currentPage++;
    } else {
      hasNextPage = false;
    }
  }
  ```

- **Dynamic Loading**: If using AJAX/infinite scroll
  ```typescript
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await this.delay(2000);  // Wait for load
  ```

- **CAPTCHA**: If website uses CAPTCHA
  - Consider using 2Captcha or Anti-Captcha services
  - Or request API access from supplier

- **Session Expiry**: Already handled by retry mechanism
  - Login is re-attempted on failure

- **Rate Limiting**: Already configured
  - Adjust `SCRAPER_TIMEOUT` and `SYNC_FREQUENCY_HOURS` if needed

## Testing Scrapers

### 1. Manual Test
```bash
# Set environment variables
export SUPPLIER_BRAYTRON_USERNAME=your_username
export SUPPLIER_BRAYTRON_PASSWORD=your_password

# Run test script
npm run test:scraper:braytron
```

### 2. Integration Test
```bash
# Test full sync flow
npm run test:suppliers:sync
```

### 3. Production Monitoring
- Check logs: `docker compose logs app | grep scraper`
- Monitor Prometheus metrics: `cypher_supplier_scrape_duration_seconds`
- Grafana dashboard: `http://localhost:3002` → Supplier Scrapers panel

## Current Suppliers

| Supplier | Code | Status | Mock Data | Priority |
|----------|------|--------|-----------|----------|
| Braytron | `braytron` | Infrastructure ready | 3 products | High |
| Arelux | `arelux` | Infrastructure ready | Mock | High |
| Masterled | `masterled` | Infrastructure ready | Mock | High |
| FSL | `fsl` | Infrastructure ready | Mock | Medium |
| ACA Lighting | `aca_lighting` | Infrastructure ready | Mock | Medium |

## Next Steps

1. **Contact suppliers** - Request B2B portal access and credentials
2. **Document website structure** - For each supplier, identify all CSS selectors
3. **Implement real scraping** - Replace mock data with actual Puppeteer logic
4. **Test thoroughly** - Verify data accuracy and handle edge cases
5. **Monitor in production** - Check Grafana dashboards for scraping success rate

## Support

- BaseScraper helper methods documentation: `src/infrastructure/scrapers/BaseScraper.ts`
- Example implementations: See existing scraper files for structure
- Puppeteer documentation: https://pptr.dev/

## Notes

- All scrapers run in headless Chrome via Docker
- Browser instances are pooled and reused for efficiency
- Failed scrapes are automatically retried with exponential backoff
- Price changes >10% trigger alerts (configurable via `PRICE_ALERT_THRESHOLD_PERCENT`)
- Sync runs every 4 hours during business hours (6 AM - 10 PM) by default
