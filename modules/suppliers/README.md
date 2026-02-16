# Supplier Integration Module for CYPHER ERP

Complete supplier integration module for managing product synchronization, SKU mapping, and automated ordering from multiple suppliers via web scraping.

## Features

### Suppliers Supported
- **Aca Lighting** (~5000+ products)
- **Masterled** (~1000+ products)
- **Arelux** (~1000+ products)
- **Braytron** (~500 products)
- **FSL** (~800 products)

### Core Capabilities

1. **Web Scraping Integration**
   - Puppeteer/Cheerio-based scraping
   - 30-second timeout per supplier
   - 3 retries with exponential backoff

2. **Product Synchronization**
   - Automatic sync every 4 hours (06:00-22:00)
   - Stock quantity tracking
   - 52-week price history

3. **Price Monitoring**
   - Alert on >10% price changes
   - Price change tracking
   - Historical analysis

4. **SKU Mapping**
   - Supplier to internal product mapping
   - Coverage reporting

5. **Supplier Ordering**
   - WhatsApp message generation
   - Order status tracking

## Architecture

Follows hexagonal architecture with clear separation of concerns:

- **Domain Layer**: Core business entities and rules
- **Application Layer**: Use cases and business logic
- **Infrastructure Layer**: Data access and external integrations
- **API Layer**: HTTP endpoints and validation

## API Endpoints

- GET /api/v1/suppliers
- GET /api/v1/suppliers/:id
- GET /api/v1/suppliers/:id/products
- POST /api/v1/suppliers/:id/sync
- POST /api/v1/suppliers/sync-all
- GET /api/v1/suppliers/:id/sku-mappings
- POST /api/v1/suppliers/:id/sku-mappings
- DELETE /api/v1/suppliers/sku-mappings/:mappingId
- POST /api/v1/suppliers/:id/orders
- GET /api/v1/suppliers/:id/orders

## Installation

```bash
npm install
cp .env.example .env
npm run build
npm test
```

## License

MIT
