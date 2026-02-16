# CYPHER ERP Database Schema

Complete PostgreSQL 15 database schema for the CYPHER ERP system.

## Files

- **schema.sql** - Complete database schema (1314 lines)
- **SCHEMA_SUMMARY.txt** - Comprehensive overview of all components
- **TABLE_STATISTICS.txt** - Detailed table structure and relationships
- **VALIDATION.txt** - Complete validation and deployment guide
- **README.md** - This file

## Quick Start

### Docker Integration

```yaml
services:
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: cypher_erp
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secure_password
    volumes:
      - ./schema.sql:/docker-entrypoint-initdb.d/01-init.sql
    ports:
      - "5432:5432"
```

### Local PostgreSQL

```bash
psql -U postgres -d cypher_erp -f schema.sql
```

## Schema Overview

### Statistics

- **2** Extensions (uuid-ossp, pgcrypto)
- **15** Enum Types (87 total values)
- **49** Tables
- **110** Indexes
- **38** Triggers
- **1** Trigger Function

### Domains

1. **User Domain** (4 tables) - User management, authentication, 2FA
2. **Customer Domain** (3 tables) - B2B/B2C customers, tiers, credit limits
3. **Category Domain** (2 tables) - Product categories with translations
4. **Product Domain** (3 tables) - Product catalog with images
5. **Supplier Domain** (3 tables) - Supplier management and SKU mapping
6. **Warehouse/Stock Domain** (4 tables) - Multi-warehouse inventory
7. **Pricing Domain** (4 tables) - Complex pricing rules and discounts
8. **Quote Domain** (3 tables) - Quote generation and tracking
9. **Order Domain** (4 tables) - Complete order management
10. **Configurator Domain** (6 tables) - Product configuration (tracks, LEDs)
11. **Integration Domain** (3 tables) - SmartBill, WooCommerce sync
12. **Communication Domain** (2 tables) - WhatsApp, notifications
13. **B2B Domain** (5 tables) - B2B registration, carts, projects
14. **System Domain** (3 tables) - Audit logs, settings, migrations

## Key Features

### Data Integrity
- Email validation on all email fields
- CHECK constraints on all monetary amounts
- UNIQUE constraints on natural keys
- FOREIGN KEY constraints with CASCADE/SET NULL/RESTRICT rules
- GENERATED columns for calculated values

### Multi-Tenancy Support
- Customer tier system
- Per-customer pricing
- Per-customer credit limits
- Customer-specific device tracking

### Multi-Language Support
- Translation tables for categories and products
- Language code columns throughout

### Audit & Compliance
- Soft deletes (deleted_at) on critical entities
- Complete audit logging
- Order status history
- Integration sync logs

### Financial Tracking
- Base, promotional, volume, and custom pricing
- Tax and discount tracking
- Credit limit management
- Invoice generation

### Integration Ready
- SmartBill accounting integration
- WooCommerce e-commerce sync
- Supplier system integration
- API credential fields

### Configuration Management
- LED track lighting configurator
- LED strip lighting configurator
- Compatibility rules for components

### Scalability
- BIGSERIAL primary keys
- JSONB metadata columns
- DECIMAL(12,2) for financial calculations
- Optimized indexing

## Column Standards

Every table includes:
- `id` - BIGSERIAL PRIMARY KEY
- `created_at` - TIMESTAMP WITH TIME ZONE (auto-populated)
- `updated_at` - TIMESTAMP WITH TIME ZONE (auto-maintained)

Soft-deletable tables also include:
- `deleted_at` - TIMESTAMP WITH TIME ZONE (NULL = not deleted)

## Naming Conventions

- **Tables:** lowercase_with_underscores
- **Columns:** lowercase_with_underscores
- **Indexes:** idx_[table]_[column(s)]
- **Triggers:** trigger_[table]_[operation]
- **Foreign Keys:** [referenced_table]_id

## Constraints

### Email Validation
Regex: `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$`

### Monetary Amounts
- All prices, costs, limits: `>= 0`
- Percentages: `0-100`
- Quantities: `> 0`

## Performance Optimization

### Indexes (110 total)
- Foreign key indexes for JOIN performance
- Search indexes (email, SKU, code, status)
- Composite indexes for multi-field queries
- Date range indexes for temporal queries
- Partial indexes for active records

### Data Types
- DECIMAL(12,2) for precise financial calculations
- BIGSERIAL for unlimited growth
- JSONB for flexible metadata
- TIMESTAMP WITH TIME ZONE for timezone awareness
- ENUM for type safety

## Deployment

1. **Set up PostgreSQL 15 container** with schema mount
2. **Schema auto-initializes** on first run
3. **Verify installation:**
   ```bash
   psql -h localhost -U postgres -d cypher_erp -c "\dt"
   ```

## Database Features

### Soft Deletes
Tables supporting soft delete:
- users
- customers
- products
- suppliers
- orders

Query active records: `WHERE deleted_at IS NULL`

### Automatic Timestamps
The `update_updated_at_column()` trigger function automatically updates the `updated_at` column on every table modification.

### Audit Logging
The `audit_logs` table tracks all entity changes with:
- User who made the change
- IP address
- Old and new values
- Entity type and ID
- Action performed

### Referential Integrity
- CASCADE deletes for child records
- SET NULL for optional references
- RESTRICT for critical references
- All foreign keys properly indexed

## PostgreSQL 15 Compatibility

All features are fully compatible with PostgreSQL 15:
- BIGSERIAL
- DECIMAL precision and scale
- TIMESTAMP WITH TIME ZONE
- JSONB
- ENUM types
- Generated columns
- Partial indexes
- Array columns
- PL/pgSQL triggers

## Extensions Required

- **uuid-ossp** - UUID generation functions (optional, not actively used but available)
- **pgcrypto** - Cryptographic functions (optional, not actively used but available)

## Known Limitations

1. Generated columns (discount_percentage) are read-only
2. Soft deletes require application-level WHERE filters
3. Enum values require ALTER TYPE to modify (breaking change)
4. JSONB metadata requires application-level validation
5. Password hashes must be pre-computed (never stored in plain text)
6. API credentials should be encrypted at application level
7. Trigger timestamps use CURRENT_TIMESTAMP (UTC)

## Support

For schema documentation, see:
- SCHEMA_SUMMARY.txt - High-level overview
- TABLE_STATISTICS.txt - Detailed table structures
- VALIDATION.txt - Complete validation report

For questions or modifications, refer to the database design documentation.

---

**Status:** Complete and Production Ready
**Version:** PostgreSQL 15
**Generated:** February 7, 2024
**File Size:** 48 KB (1314 lines)
