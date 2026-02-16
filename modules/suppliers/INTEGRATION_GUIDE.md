# Supplier Module Integration Guide

## Setup Instructions

### 1. Database Setup

Create TypeORM migrations for the supplier module tables:

```typescript
// typeorm-cli commands
typeorm migration:generate -n CreateSupplierTables
typeorm migration:run
```

Or use the provided entity definitions:
- SupplierEntityDb
- SupplierProductEntityDb
- SkuMappingEntityDb
- SupplierOrderEntityDb

### 2. Configure Express Application

```typescript
import express from 'express';
import { DataSource } from 'typeorm';
import {
  TypeOrmSupplierRepository,
  SupplierSyncJob,
  createSupplierRoutes,
  SupplierEntityDb,
  SupplierProductEntityDb,
  SkuMappingEntityDb,
  SupplierOrderEntityDb,
} from '@cypher-erp/suppliers';

const app = express();

// Initialize TypeORM DataSource
const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    SupplierEntityDb,
    SupplierProductEntityDb,
    SkuMappingEntityDb,
    SupplierOrderEntityDb,
  ],
  synchronize: false,
  logging: true,
});

// Initialize repository
const repository = new TypeOrmSupplierRepository(
  dataSource.getRepository(SupplierEntityDb),
  dataSource.getRepository(SupplierProductEntityDb),
  dataSource.getRepository(SkuMappingEntityDb),
  dataSource.getRepository(SupplierOrderEntityDb),
);

// Setup sync job
const syncJob = new SupplierSyncJob(repository, {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

// Schedule automatic syncing
await syncJob.scheduleSync();

// Add routes
app.use('/api/v1', createSupplierRoutes(repository, syncJob));

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: err.message,
  });
});

app.listen(3000, () => {
  console.log('Supplier module running on port 3000');
});
```

### 3. Seed Initial Supplier Data

```typescript
import { KNOWN_SUPPLIERS, SupplierCode } from '@cypher-erp/suppliers';

async function seedSuppliers(dataSource: DataSource) {
  const supplierRepo = dataSource.getRepository(SupplierEntityDb);

  for (const [code, supplierData] of Object.entries(KNOWN_SUPPLIERS)) {
    const existing = await supplierRepo.findOne({ where: { code } });

    if (!existing) {
      await supplierRepo.save({
        ...supplierData,
        code,
        isActive: true,
        credentials: {
          username: process.env[`SUPPLIER_${code.toUpperCase()}_USERNAME`],
          password: process.env[`SUPPLIER_${code.toUpperCase()}_PASSWORD`],
        },
      });
    }
  }

  console.log('Suppliers seeded successfully');
}

// Run during app initialization
await dataSource.initialize();
await seedSuppliers(dataSource);
```

### 4. Environment Variables

Create `.env` file with required variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cypher_erp
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=cypher_erp

# Redis (for BullMQ)
REDIS_HOST=localhost
REDIS_PORT=6379

# Supplier Credentials
SUPPLIER_ACA_LIGHTING_USERNAME=username
SUPPLIER_ACA_LIGHTING_PASSWORD=password

SUPPLIER_MASTERLED_USERNAME=username
SUPPLIER_MASTERLED_PASSWORD=password

SUPPLIER_ARELUX_USERNAME=username
SUPPLIER_ARELUX_PASSWORD=password

SUPPLIER_BRAYTRON_USERNAME=username
SUPPLIER_BRAYTRON_PASSWORD=password

SUPPLIER_FSL_USERNAME=username
SUPPLIER_FSL_PASSWORD=password

# Scraping Configuration
SCRAPER_TIMEOUT=30000
SCRAPER_MAX_RETRIES=3

# Sync Configuration
SYNC_FREQUENCY_HOURS=4
SYNC_WINDOW_START_HOUR=6
SYNC_WINDOW_END_HOUR=22

# Price Alert
PRICE_ALERT_THRESHOLD=10
```

## API Examples

### Get All Suppliers

```bash
curl http://localhost:3000/api/v1/suppliers
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Aca Lighting",
      "code": "aca-lighting",
      "website": "https://aca-lighting.com",
      "isActive": true,
      "productCount": 5000,
      "lastSync": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 5
}
```

### Get Supplier Products with Filters

```bash
curl "http://localhost:3000/api/v1/suppliers/1/products?search=LED&minStock=10&limit=20"
```

### Trigger Sync for One Supplier

```bash
curl -X POST http://localhost:3000/api/v1/suppliers/1/sync
```

Response:
```json
{
  "success": true,
  "data": {
    "supplierId": 1,
    "supplierName": "Aca Lighting",
    "productsFound": 5000,
    "productsUpdated": 250,
    "productsCreated": 50,
    "priceChanges": [
      {
        "supplierSku": "LED-001",
        "productName": "LED Bulb",
        "oldPrice": 10,
        "newPrice": 11,
        "changePercentage": 10
      }
    ],
    "significantPriceChanges": [],
    "duration": 15000
  }
}
```

### Create SKU Mapping

```bash
curl -X POST http://localhost:3000/api/v1/suppliers/1/sku-mappings \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId": 1,
    "supplierSku": "LED-001",
    "internalProductId": 100,
    "internalSku": "INT-LED-001"
  }'
```

### Place Supplier Order

```bash
curl -X POST http://localhost:3000/api/v1/suppliers/1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "supplierSku": "LED-001",
        "quantity": 5
      },
      {
        "supplierSku": "LED-002",
        "quantity": 10
      }
    ],
    "orderId": 12345
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "orderId": 1,
    "supplierId": 1,
    "whatsappMessage": "🛒 *NEW ORDER REQUEST*\n\n*Order ID:* 12345\n...",
    "whatsappUrl": "https://wa.me/201234567890?text=...",
    "items": [...],
    "itemCount": 2,
    "totalEstimate": 150,
    "currency": "USD"
  }
}
```

### Get SKU Mapping Status

```bash
curl http://localhost:3000/api/v1/suppliers/1/unmapped-products
```

Response:
```json
{
  "success": true,
  "data": {
    "supplierId": 1,
    "totalUnmapped": 2500,
    "mappedCount": 2500,
    "coveragePercentage": 50,
    "products": [...]
  }
}
```

## Monitoring and Maintenance

### Monitor Sync Jobs

```typescript
import { SupplierSyncJob } from '@cypher-erp/suppliers';

const syncJob = new SupplierSyncJob(repository);

// Manually trigger sync for debugging
const job = await syncJob.triggerSync(supplierId);
console.log('Job ID:', job.id);
```

### View Price Changes

```typescript
import { GetSupplierProducts } from '@cypher-erp/suppliers';

const getProducts = new GetSupplierProducts(repository);
const stats = await getProducts.getStatistics(supplierId);

console.log('Total Value:', stats.totalValue);
console.log('In Stock:', stats.inStock);
console.log('Out of Stock:', stats.outOfStock);
```

### Check SKU Coverage

```typescript
import { MapSku } from '@cypher-erp/suppliers';

const mapSku = new MapSku(repository);
const unmapped = await mapSku.getUnmapped(supplierId);

console.log('Unmapped Products:', unmapped.totalUnmapped);
console.log('Coverage %:', unmapped.coveragePercentage);
```

## Error Handling

The module throws domain-specific errors that should be caught and handled:

```typescript
import {
  SupplierNotFoundError,
  ScrapeError,
  SkuMappingError,
  InvalidOrderError,
} from '@cypher-erp/suppliers';

try {
  await scrapeUseCase.execute(supplierId);
} catch (error) {
  if (error instanceof SupplierNotFoundError) {
    // Handle supplier not found
  } else if (error instanceof ScrapeError) {
    // Handle scraping error
  } else if (error instanceof SkuMappingError) {
    // Handle SKU mapping error
  }
}
```

## Performance Tips

1. **Batch SKU Mappings**: Use bulk operations for large imports
2. **Filter Products**: Use search and price filters to reduce data transfer
3. **Monitor Sync Duration**: Check duration in ScrapeResult
4. **Use Redis**: Ensure Redis is available for job queuing
5. **Database Indexes**: All tables have appropriate indexes

## Troubleshooting

### Suppliers Not Syncing

1. Check Redis connection
2. Verify supplier credentials in database
3. Check sync window (06:00-22:00)
4. Review logs for scraper errors

### High Memory Usage During Scrape

1. Increase timeout to allow cleanup
2. Check for large product datasets
3. Monitor batch sizes for bulk upserts

### SKU Mapping Issues

1. Verify internal product IDs exist
2. Check for duplicate mappings
3. Review unmapped products report

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Redis instance available
- [ ] Supplier credentials stored securely
- [ ] Initial suppliers seeded
- [ ] Sync job scheduled and tested
- [ ] API endpoints tested
- [ ] Error handling configured
- [ ] Monitoring/logging setup
- [ ] Documentation reviewed
