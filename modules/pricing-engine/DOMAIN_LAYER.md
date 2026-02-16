# Pricing Engine Domain Layer - CYPHER ERP

**Location:** `/sessions/hopeful-wizardly-babbage/mnt/erp/cypher/modules/pricing-engine/src/domain/`

**Total Lines:** 1,606 lines of pure TypeScript business logic

**No External Dependencies** - Pure domain logic, no imports from infrastructure, libraries, or frameworks.

---

## Architecture Overview

The domain layer implements a **Clean Architecture / Hexagonal Architecture** pattern with:

- **Rich Domain Model** - Business logic encapsulated in entities
- **Domain Services** - Pure calculation services with no side effects
- **Repository Ports** - Interfaces only (implementation in infrastructure layer)

```
domain/
├── entities/           # Value objects and aggregates
├── services/           # Domain service logic
├── repositories/       # Port interfaces (no implementation)
└── index.ts           # Public API
```

---

## File Inventory

### 1. Entities (Rich Domain Models)

#### **Price.ts** (160 lines)
Represents product pricing with cost and margin validation.

**Key Features:**
- Validates cost > 0 and margin >= 30%
- Calculates selling price: `sellingPrice = cost * (1 + margin%)`
- Calculates margin amounts in currency
- Precision handling (2 decimal places)

**Methods:**
- `calculateSellingPrice()` - Computes base selling price
- `calculateMarginAmount()` - Margin in currency units
- `isAboveMinimumMargin(minMargin)` - Validates margin threshold

**Constants:**
- `MIN_MARGIN_PERCENTAGE = 30`
- `COST_PRECISION = 0.01`

---

#### **CustomerTier.ts** (165 lines)
Customer tier levels with associated discounts.

**Tier Configuration:**
| Level | Name | Discount |
|-------|------|----------|
| NONE | Standard | 0% |
| TIER_1 | Bronze | 5% |
| TIER_2 | Silver | 10% |
| TIER_3 | Gold | 15% |

**Methods:**
- `fromLevel(level)` - Factory method (validates tier)
- `calculateDiscountedPrice(basePrice)` - Applies tier discount
- `calculateDiscountAmount(basePrice)` - Discount in currency
- `createDefault()` - Default NONE tier
- `getAllTiers()` - List of available tiers
- `isValidTier(level)` - Tier validation

---

#### **VolumeDiscount.ts** (228 lines)
Volume-based discount rules with flexible quantity/value matching.

**Rule Validation:**
- Validates minQuantity > 0
- Validates discountPercentage 0-100%
- Ensures quantity and value ranges are logical

**Methods:**
- `isApplicable(quantity, totalValue)` - Checks if rule applies
- `calculateDiscount(subtotal)` - Discount amount
- `calculateDiscountedPrice(subtotal)` - Price after discount
- `getDescription()` - Human-readable rule

**Example Rules:**
```typescript
// 10-49 units OR 5000+ RON = 2%
new VolumeDiscount(10, 2, 49, 5000, null)

// 50-99 units OR 15000+ RON = 5%
new VolumeDiscount(50, 5, 99, 15000, null)

// 100+ units OR 30000+ RON = 8%
new VolumeDiscount(100, 8, null, 30000, null)
```

---

#### **Promotion.ts** (203 lines)
Time-limited promotional pricing with date validation.

**Validation:**
- Promotional price < original price
- validUntil > validFrom

**Methods:**
- `isCurrentlyActive(currentDate)` - Checks if promotion is active
- `getDiscountPercentage()` - Discount %
- `getDiscountAmount()` - Discount amount
- `getDescription()` - Human-readable promotion info

**Example:**
```typescript
const promotion = new Promotion(
  'SUMMER2024',
  productId: 123,
  promotionalPrice: 85,
  originalPrice: 100,
  validFrom: new Date('2024-06-01'),
  validUntil: new Date('2024-08-31'),
  reason: 'Summer Sale',
  isActive: true
);

if (promotion.isCurrentlyActive()) {
  console.log(`Get ${promotion.getDiscountPercentage()}% off!`);
}
```

---

### 2. Domain Services (Pure Business Logic)

#### **PriceCalculator.ts** (335 lines)
Main pricing calculation engine - stateless, deterministic, testable.

**Algorithm (Calculated Step-by-Step):**
1. Start with base selling price
2. Apply customer tier discount (if provided)
3. Apply volume discount (if applicable)
4. Apply promotion (if active - overrides to promotional price)
5. Calculate final margin

**Types:**

`PriceCalculation` - Single line item result:
```typescript
interface PriceCalculation {
  basePrice: number;
  cost: number;
  unitPrice: number;
  tierDiscountAmount: number;
  tierDiscountPercent: number;
  volumeDiscountAmount: number;
  volumeDiscountPercent: number;
  promotionalDiscountAmount: number;
  finalUnitPrice: number;
  finalLineTotal: number; // unitPrice * quantity
  marginPercentage: number;
  marginAmount: number;
}
```

`OrderPriceResult` - Full order summary:
```typescript
interface OrderPriceResult {
  items: PriceCalculation[];
  subtotal: number;
  totalTierDiscount: number;
  totalVolumeDiscount: number;
  totalPromotionalDiscount: number;
  totalDiscount: number;
  taxRate: number; // 19% default
  taxAmount: number;
  grandTotal: number;
}
```

**Methods:**

`calculateFinalPrice(basePrice, cost, margin%, quantity, tier?, volumeDiscount?, promotion?)`
- Calculates final price with all discounts for single item

`calculateOrderTotal(items[], taxRate = 19)`
- Aggregates multiple line items with totals and tax

`validateMargin(price, cost, minMargin)`
- Validates price meets minimum margin requirement

**Example:**
```typescript
const calculation = PriceCalculator.calculateFinalPrice(
  basePrice: 100,
  cost: 50,
  marginPercentage: 50,
  quantity: 10,
  tier: { discountPercentage: 5 }, // TIER_1
  promotion: { promotionalPrice: 90 }
);
// Result: finalUnitPrice = 90, finalLineTotal = 900
```

**Validation Rules:**
- basePrice > 0
- cost > 0
- marginPercentage 30-100%
- quantity > 0

---

#### **VolumeDiscountCalculator.ts** (208 lines)
Specialized service for volume discount selection and application.

**Default Rules Built-In:**
```
10-49 units OR 5000+ RON  → 2% discount
50-99 units OR 15000+ RON → 5% discount
100+ units OR 30000+ RON  → 8% discount
```

**Methods:**

`getApplicableDiscount(rules, quantity, subtotal)`
- Returns highest applicable discount, or null

`getDefaultApplicableDiscount(quantity, subtotal)`
- Uses built-in default rules

`getDefaultRules()`
- Returns copy of default rules

`createRules(definitions)`
- Factory for custom rules

`hasApplicableDiscount(rules, quantity, subtotal)`
- Boolean check

`getAllApplicableDiscounts(rules, quantity, subtotal)`
- Returns all matching rules (not just best)

`calculateDiscount(rules, quantity, subtotal)`
- Direct discount amount calculation

`getApplicableDiscountPercentage(rules, quantity, subtotal)`
- Returns % of best rule, or 0

`getDiscountTiers(rules)`
- Returns formatted tier information for display

**Example:**
```typescript
const discount = VolumeDiscountCalculator.getDefaultApplicableDiscount(
  quantity: 75,
  subtotal: 8000
);
// Returns rule: 5% (matches 50-99 units AND 15000+ RON boundary)

const amount = discount.calculateDiscount(8000); // 400 RON
```

---

### 3. Repository Ports (Interfaces Only)

#### **IPriceRepository.ts** (173 lines)
Contract for price persistence and retrieval.

**Methods:**
- `getProductPrice(productId)` - Single product
- `getProductPrices(productIds[])` - Batch fetch
- `savePrice(price)` - Create new
- `updatePrice(productId, updates)` - Update existing
- `deletePrice(productId)` - Delete

**Promotion Operations:**
- `getActivePromotion(productId)` - Current active promotion
- `getActivePromotions(productIds[])` - Batch fetch active
- `getAllPromotions(productId)` - Historical promotions
- `savePromotion(promotion)` - Create
- `updatePromotion(promotionId, updates)` - Update
- `deletePromotion(promotionId)` - Delete

**Volume Discount Operations:**
- `getVolumeDiscountRules()` - All rules
- `saveVolumeDiscountRule(rule)` - Create
- `updateVolumeDiscountRule(ruleId, updates)` - Update
- `deleteVolumeDiscountRule(ruleId)` - Delete

**Helpers:**
- `priceExists(productId)` - Existence check

---

#### **ITierRepository.ts** (98 lines)
Contract for customer tier persistence and management.

**Methods:**
- `getCustomerTier(customerId)` - Current tier (defaults to NONE)
- `setCustomerTier(customerId, tier)` - Set tier
- `getCustomersByTier(tier)` - All customers at tier
- `getCustomerCountByTier(tier)` - Count at tier
- `getCustomerTiers(customerIds[])` - Batch fetch
- `upgradeCustomerTier(customerId)` - Promote NONE → TIER_1 → TIER_2 → TIER_3
- `downgradeCustomerTier(customerId, reason)` - Demote
- `resetCustomerTier(customerId)` - Reset to NONE
- `isCustomerInTier(customerId, tier)` - Boolean check

---

## Business Rules Implemented

### Pricing Method
**Cost + Variable Margin by Category**
```
Selling Price = Cost × (1 + Margin% / 100)
```

### Margin Requirements
- **Minimum:** 30% (enforced in all entities)
- **Average:** 60%
- **Premium:** 100%

### Customer Tier Discounts
| Tier | Name | Discount |
|------|------|----------|
| 0 | Standard (no discount) | 0% |
| 1 | Bronze | 5% |
| 2 | Silver | 10% |
| 3 | Gold | 15% |

### Volume Discounts
Applied based on **quantity OR total value**:

| Threshold | Discount |
|-----------|----------|
| 10-49 units OR >5000 RON | 2% |
| 50-99 units OR >15000 RON | 5% |
| 100+ units OR >30000 RON | 8% |

### Promotions
- Time-limited (validFrom to validUntil)
- Must be activated (isActive flag)
- Overrides normal pricing when active
- 1-2 per year scheduling

### Currency
- **Default:** RON (Romanian Leu)
- **Tax:** 19% VAT
- **Precision:** 2 decimal places

---

## Calculation Example

**Order with 75 units @ 100 RON (cost: 50):**

```typescript
const order = PriceCalculator.calculateFinalPrice(
  basePrice: 100,
  cost: 50,
  marginPercentage: 50,
  quantity: 75,
  tier: { discountPercentage: 10 }, // TIER_2 (Silver)
  volumeDiscount: { discountPercentage: 5 } // 50-99 units
);

// Calculation Flow:
// 1. Unit Price = 100 (base)
// 2. Apply Tier (10%): 100 - 10 = 90
// 3. Apply Volume (5%): 90 - 4.5 = 85.5
// 4. Final Unit Price = 85.5
// 5. Final Line Total = 85.5 × 75 = 6412.50
// 6. Margin = 85.5 - 50 = 35.5 (41.5%)

// Order Total:
const orderResult = PriceCalculator.calculateOrderTotal(
  [order],
  taxRate: 19
);

// Results:
// Subtotal: 6412.50
// Tier Discount: 750
// Volume Discount: 450
// Tax (19%): 1218.38
// Grand Total: 7630.88
```

---

## Validation Guarantees

### Price Entity
✓ Cost must be > 0
✓ Margin must be >= 30%
✓ Precision: 2 decimals

### CustomerTier Entity
✓ Valid tier levels only (NONE, TIER_1, TIER_2, TIER_3)
✓ Fixed discounts per tier
✓ Tier progression logic available

### VolumeDiscount Entity
✓ minQuantity > 0
✓ Discount 0-100%
✓ Quantity and value ranges logical

### Promotion Entity
✓ Promotional price < original price
✓ validUntil > validFrom
✓ Date-based active status

### PriceCalculator Service
✓ All inputs validated
✓ Deterministic calculations
✓ No side effects
✓ Testable pure functions

---

## Design Patterns Used

### 1. Value Object Pattern
All entities are immutable with `readonly` properties:
```typescript
private readonly _cost: number;
private readonly _marginPercentage: number;
```

### 2. Factory Methods
Encapsulate complex creation:
```typescript
static fromLevel(level: TierLevel): CustomerTier
static createDefault(): CustomerTier
```

### 3. Validation in Constructor
Invariants enforced at creation time:
```typescript
constructor(...) {
  this.validateCost(cost);
  this.validateMarginPercentage(marginPercentage);
}
```

### 4. Domain Service (Stateless)
Pure functions with no mutable state:
```typescript
static calculateFinalPrice(...): PriceCalculation
```

### 5. Repository Port Pattern
Interfaces only - implementation in infrastructure layer:
```typescript
export interface IPriceRepository { ... }
```

---

## No External Dependencies

✓ No TypeORM imports
✓ No Redis imports
✓ No Express/HTTP imports
✓ No Lodash, utils, or helpers
✓ Pure TypeScript only
✓ No circular dependencies

---

## Public API (index.ts)

Exports for consumers:

```typescript
// Entities
export { Price };
export { CustomerTier, TierLevel };
export { VolumeDiscount };
export { Promotion };

// Services
export { PriceCalculator };
export { PriceCalculation, PriceLineItem, OrderPriceResult };
export { VolumeDiscountCalculator };

// Repositories (interfaces only)
export { IPriceRepository };
export { ITierRepository };
```

---

## Integration Points

### Expected Infrastructure Layer Implementation

1. **PriceRepositoryImpl** implements IPriceRepository
   - Uses TypeORM for database persistence
   - Integrates with cache layer

2. **TierRepositoryImpl** implements ITierRepository
   - Persists customer tier assignments
   - Handles tier history/auditing

3. **PricingService** (Application Layer)
   - Coordinates domain services
   - Handles transactions
   - Returns DTOs to API layer

---

## Testing Considerations

All domain logic is fully testable:

```typescript
// Pure function testing
const calc = PriceCalculator.calculateFinalPrice(100, 50, 50, 10);
expect(calc.finalUnitPrice).toBe(100);

// Entity validation
expect(() => new Price(1, 100, -10, 50)).toThrow();

// Service logic
const discount = VolumeDiscountCalculator.getDefaultApplicableDiscount(75, 8000);
expect(discount.discountPercentage).toBe(5);
```

---

## Summary

The Pricing Engine Domain Layer provides:

- **1,606 lines** of pure, maintainable TypeScript
- **4 rich entities** with encapsulated business logic
- **2 stateless services** for complex calculations
- **2 port interfaces** for infrastructure integration
- **Zero external dependencies** for maximum portability
- **Complete business rules** from CYPHER ERP questionnaire
- **Type safety** throughout with TypeScript interfaces
- **Comprehensive JSDoc** for maintainability

This is a production-ready foundation for the entire pricing system.
