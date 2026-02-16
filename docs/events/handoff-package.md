# Cypher ERP Event Architecture - Handoff Package

## Document Information

| Field | Value |
|--------|--------|
| Document Version | 1.0.0 |
| Created Date | 2026-02-13 |
| Last Updated | 2026-02-13 |
| Author | Events Team |
| Status | Production Ready |

---

## Table of Contents

1. [Overview](#1-overview)
2. [Handoff to AI1 (Infrastructure)](#2-handoff-to-ai1-infrastructure)
3. [Handoff to AI4 (Jobs)](#3-handoff-to-ai4-jobs)
4. [Handoff to AI6 (Pricing)](#4-handoff-to-ai6-pricing)
5. [Handoff to AI7 (Checkout)](#5-handoff-to-ai7-checkout)
6. [Handoff to AI8 (Credit)](#6-handoff-to-ai8-credit)
7. [Handoff to AI9 (Catalog)](#7-handoff-to-ai9-catalog)
8. [Event Contracts Summary](#8-event-contracts-summary)
9. [Deployment Checklist](#9-deployment-checklist)
10. [Contact Information](#10-contact-information)

---

## 1. Overview

### 1.1 Purpose

This document provides comprehensive handoff instructions for the Cypher ERP event-driven architecture to responsible teams. It outlines the complete event system infrastructure, event contracts, and implementation guidelines for each receiving team.

### 1.2 Architecture Summary

Cypher ERP implements an event-driven architecture using:

- **Event Bus**: RabbitMQ with topic exchanges for flexible routing
- **Event Envelope**: Standardized wrapper for all events with tracing and versioning
- **Schema Registry**: JSON Schema validation for all event payloads
- **Outbox Pattern**: Guaranteed event delivery via database-backed outbox
- **Retry Mechanism**: Exponential backoff with dead letter queues
- **Topology as Code**: Terraform-managed RabbitMQ infrastructure

### 1.3 Key Components

| Component | Location | Description |
|------------|-------------|-------------|
| Event Types | `/opt/cypher-erp/events/types/EventEnvelope.ts` | Type definitions and factory |
| Schema Registry | `/opt/cypher-erp/events/registry/index.ts` | Event schema validation |
| Event Schemas | `/opt/cypher-erp/events/schemas/` | JSON Schema files |
| Outbox Relay | `/opt/cypher-erp/modules/outbox-relay/` | Event publishing service |
| RabbitMQ Config | `/opt/cypher-erp/infrastructure/rabbitmq/` | Infrastructure as code |

### 1.4 Event Priority Levels

| Priority | Use Case | Processing SLA |
|----------|-------------|-----------------|
| `critical` | Order creation, payment processing | < 1 second |
| `high` | Stock changes, price updates | < 5 seconds |
| `normal` | Product updates, notifications | < 30 seconds |
| `low` | Analytics, background tasks | Best effort |

---

## 2. Handoff to AI1 (Infrastructure)

### 2.1 Responsibilities

AI1 team is responsible for:

- RabbitMQ cluster management and high availability
- Infrastructure monitoring and alerting
- Event bus topology maintenance
- Network security and access control
- Disaster recovery procedures

### 2.2 Current Infrastructure State

#### RabbitMQ Configuration

```yaml
# Environment Variables
RABBITMQ_HOST: localhost
RABBITMQ_PORT: 5672
RABBITMQ_MGMT_PORT: 15672
RABBITMQ_USER: admin
RABBITMQ_VHOST: cypher.{env}
```

#### Exchanges

| Exchange | Type | Purpose |
|----------|------|---------|
| `cypher.{env}.events.topic` | topic | Main events exchange |
| `cypher.{env}.events.retry` | topic | Retry exchange for failed messages |
| `cypher.{env}.events.dlq` | topic | Dead letter exchange |

#### Queues (Current)

| Queue Name | Event Type | Consumer | Priority |
|-------------|-------------|-----------|------------|
| `q.{env}.search-indexer.product-updated` | product.updated | normal |
| `q.{env}.pricing-worker.price-changed` | price.changed | high |
| `q.{env}.notification-worker.order-created` | order.created | normal |
| `q.{env}.credit-worker.order-cancelled` | order.cancelled | high |
| `q.{env}.erp-sync.order-created` | order.created | normal |

### 2.3 Infrastructure as Code

Location: `/opt/cypher-erp/infrastructure/rabbitmq/`

```bash
# Apply topology
cd /opt/cypher-erp/infrastructure/rabbitmq
terraform init
terraform plan -var-file="env/dev.tfvars"
terraform apply -var-file="env/dev.tfvars"

# View outputs
terraform output application_config
```

### 2.4 Monitoring Setup

#### Prometheus Metrics

Enable metrics in RabbitMQ:

```bash
docker exec rabbitmq rabbitmq-plugins enable rabbitmq_prometheus
```

Key metrics to monitor:

| Metric | Warning Threshold | Critical Threshold |
|--------|-------------------|--------------------|
| `rabbitmq_queue_messages` | > 1,000 | > 10,000 |
| `rabbitmq_queue_messages_unacked` | > 500 | > 2,000 |
| `rabbitmq_queue_message_rate_publish_total` | Increasing trend | Sudden spike |
| `rabbitmq_dlx_messages` | > 10 | > 100 |

#### Grafana Dashboard

Dashboard location: `/opt/cypher-erp/infrastructure/rabbitmq/grafana/dashboards/rabbitmq-overview.json`

Import steps:
1. Open Grafana (http://{host}:3000)
2. Navigate to Dashboards > Import
3. Upload the JSON file
4. Select Prometheus datasource

### 2.5 Backup and Recovery

#### Export Topology

```bash
# Export queue definitions
rabbitmqadmin -u admin -p admin export > rabbitmq-backup-$(date +%Y%m%d).json
```

#### Restore Topology

```bash
# Import queue definitions
rabbitmqadmin -u admin -p admin import < rabbitmq-backup.json
```

#### Disaster Recovery

1. **Cluster Failure**: Use shoveling to transfer messages to backup cluster
2. **Data Loss**: Replay events from outbox table if publisher confirms failed
3. **Queue Corruption**: Purge and redeclare via Terraform

### 2.6 Required Actions

| Priority | Action | Target Date |
|----------|---------|-------------|
| P0 | Set up production RabbitMQ cluster with HA | 2026-03-01 |
| P0 | Configure network ACLs for inter-service communication | 2026-03-01 |
| P1 | Implement automated topology deployment pipeline | 2026-03-15 |
| P1 | Set up infrastructure alerting with PagerDuty | 2026-03-15 |
| P2 | Document and test disaster recovery procedures | 2026-04-01 |

---

## 3. Handoff to AI4 (Jobs)

### 3.1 Responsibilities

AI4 team is responsible for:

- Outbox relay service operation and monitoring
- Background job scheduling and execution
- Event retry and dead letter queue management
- Job orchestration across services

### 3.2 Outbox Relay Service

Location: `/opt/cypher-erp/modules/outbox-relay/`

#### Architecture

```
Service writes to Outbox Table
           |
           v
    Outbox Relay Service (polls batch interval)
           |
           v
    Publishes to RabbitMQ (with publisher confirms)
           |
           v
    Consumer receives and ACKs
           |
           v
    Outbox entry marked as published
```

#### Key Classes

| Class | File | Purpose |
|--------|--------|----------|
| `OutboxRelay` | `/opt/cypher-erp/modules/outbox-relay/src/OutboxRelay.ts` | Main orchestration |
| `OutboxProcessor` | `/opt/cypher-erp/modules/outbox-relay/src/OutboxProcessor.ts` | Batch processing |
| `RabbitMQPublisher` | `/opt/cypher-erp/modules/outbox-relay/src/Publisher.ts` | Message publishing |
| `OutboxRepository` | `/opt/cypher-erp/modules/outbox-relay/src/OutboxRepository.ts` | Database operations |
| `OutboxMetrics` | `/opt/cypher-erp/modules/outbox-relay/src/Metrics.ts` | Metrics collection |

#### Configuration

Environment variables for Outbox Relay:

| Variable | Description | Default |
|----------|-------------|----------|
| `OUTBOX_BATCH_SIZE` | Number of events per batch | 50 |
| `OUTBOX_BATCH_INTERVAL_MS` | Polling interval in milliseconds | 5000 |
| `OUTBOX_RETRY_MAX_ATTEMPTS` | Max retry attempts for failed events | 3 |
| `OUTBOX_CIRCUIT_BREAKER_THRESHOLD` | Failure count before opening circuit | 5 |
| `OUTBOX_CIRCUIT_BREAKER_TIMEOUT_MS` | Time to wait before closing circuit | 60000 |

#### Outbox Table Schema

```sql
CREATE TABLE outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(255) NOT NULL,
  event_version VARCHAR(50) DEFAULT 'v1',
  payload JSONB NOT NULL,
  headers JSONB,
  routing_key VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,
  failed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status VARCHAR(50) DEFAULT 'pending'
);

CREATE INDEX idx_outbox_status ON outbox(status, created_at);
CREATE INDEX idx_outbox_event_type ON outbox(event_type, created_at);
```

### 3.3 Background Jobs

#### Job Types

| Job | Module | Schedule | Description |
|------|---------|----------|-------------|
| `SmartBillSyncJob` | inventory | Hourly | Sync products with SmartBill |
| `SupplierSyncJob` | inventory | Daily | Sync supplier catalog |
| `AlertCheckJob` | inventory | Every 15 min | Check low stock alerts |
| `PriceRebuildJob` | pricing-engine | Daily | Rebuild price cache |

#### Job Implementation Pattern

```typescript
// Base job structure
import { Job, JobSchedule } from '@cypher/jobs';

export class MyJob implements Job {
  name = 'my-job-name';
  schedule = JobSchedule.EveryHour;

  async execute(): Promise<void> {
    // 1. Acquire lock
    // 2. Execute work
    // 3. Emit events on completion
    // 4. Release lock
  }
}
```

### 3.4 Retry Strategy

Messages are retried with exponential backoff:

| Attempt | Delay | Routing Key |
|---------|-------|-------------|
| 1 | 10 seconds | `{event}.retry.1` |
| 2 | 60 seconds | `{event}.retry.2` |
| 3 | 300 seconds | `{event}.retry.3` |
| 4+ | Moved to DLQ | `{event}.dlq` |

### 3.5 Dead Letter Queue Management

#### Monitoring DLQ

```bash
# Check DLQ messages
rabbitmqadmin list queues name messages

# Inspect DLQ message
rabbitmqadmin get queue=q.{env}.dlq.{event}

# Move from DLQ (after fix)
rabbitmqsh > move_messages "q.{env}.dlq.{event}" "cypher.{env}.events.topic" "{event}"
```

#### DLQ Alerting

Set up alerts for:
- DLQ messages > 10 (warning)
- DLQ messages > 100 (critical)
- No DLQ processing for > 1 hour

### 3.6 Required Actions

| Priority | Action | Target Date |
|----------|---------|-------------|
| P0 | Deploy Outbox Relay to production | 2026-03-01 |
| P0 | Set up job scheduling service | 2026-03-01 |
| P1 | Implement DLQ monitoring and alerting | 2026-03-15 |
| P1 | Create job execution dashboard | 2026-03-15 |
| P2 | Implement job dependency management | 2026-04-01 |

---

## 4. Handoff to AI6 (Pricing)

### 4.1 Responsibilities

AI6 team is responsible for:

- Pricing engine implementation and maintenance
- Price change event consumption
- Customer tier and volume discount management
- Promotion engine integration

### 4.2 Pricing Module Structure

Location: `/opt/cypher-erp/modules/pricing-engine/`

```
pricing-engine/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Price.ts
│   │   │   ├── CustomerTier.ts
│   │   │   ├── VolumeDiscount.ts
│   │   │   └── Promotion.ts
│   │   └── services/
│   │       ├── PriceCalculator.ts
│   │       └── VolumeDiscountCalculator.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── CalculatePrice.ts
│   │   │   ├── GetTierPricing.ts
│   │   │   ├── CalculateOrderPricing.ts
│   │   │   └── ManagePromotions.ts
│   │   └── dtos/
│   │       └── pricing.dtos.ts
│   ├── api/
│   │   ├── controllers/
│   │   │   └── PricingController.ts
│   │   └── routes/
│   │       └── pricing.routes.ts
│   └── infrastructure/
│       ├── cache/
│       │   └── PriceCache.ts
│       └── repositories/
│           ├── TypeOrmPriceRepository.ts
│           └── TypeOrmTierRepository.ts
└── tests/
```

### 4.3 Event Consumption: Price Changed

#### Event Schema

Schema: `/opt/cypher-erp/events/schemas/price/price-changed-v1.json`

Required to consume: `price.changed` events

#### Queue Configuration

| Queue | Routing Key | Consumer |
|--------|-------------|-----------|
| `q.{env}.pricing-worker.price-changed` | `price.changed` | pricing-worker-service |

#### Consumer Implementation Example

```typescript
import { EventEnvelope, EventEnvelopeFactory } from '@cypher/events';
import { SchemaRegistry } from '@cypher/events';
import amqp from 'amqplib';

class PriceChangedConsumer {
  private connection;
  private channel;
  private registry: SchemaRegistry;

  async start(): Promise<void> {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();
    this.registry = await SchemaRegistry.getInstance().initialize();

    await this.channel.assertQueue(
      'q.dev.pricing-worker.price-changed',
      { durable: true }
    );
    await this.channel.bindQueue(
      'q.dev.pricing-worker.price-changed',
      'cypher.dev.events.topic',
      'price.changed'
    );

    this.channel.consume(
      'q.dev.pricing-worker.price-changed',
      this.handleMessage.bind(this)
    );
  }

  async handleMessage(msg: amqp.ConsumeMessage): Promise<void> {
    try {
      const envelope: EventEnvelope = JSON.parse(msg.content.toString());

      // Validate against schema
      const validation = await this.registry.validateEvent(envelope);
      if (!validation.valid) {
        console.error('Validation failed:', validation.errors);
        this.channel.nack(msg, false, false);
        return;
      }

      // Process price change
      await this.processPriceChange(envelope.payload);

      // Acknowledge message
      this.channel.ack(msg);
    } catch (error) {
      console.error('Processing failed:', error);
      this.channel.nack(msg, false, false);
    }
  }

  async processPriceChange(payload: any): Promise<void> {
    // Update price cache
    // Invalidate related quotes
    // Notify catalog service
    // Log pricing analytics
  }
}
```

### 4.4 Event Publishing

The pricing module should publish these events:

| Event | When to Publish | Priority |
|-------|----------------|----------|
| `price.changed` | When product price is modified | critical |
| `promotion.created` | When new promotion is created | normal |
| `promotion.updated` | When promotion is modified | normal |
| `promotion.activated` | When promotion becomes active | high |
| `promotion.deactivated` | When promotion expires | normal |

#### Publishing Example

```typescript
import { EventEnvelopeFactory, EventPriority } from '@cypher/events';
import { OutboxRepository } from '@cypher/outbox-relay';

const outboxRepo = new OutboxRepository();

async function onPriceUpdate(priceChange: PriceChange) {
  const envelope = EventEnvelopeFactory.create({
    event_type: 'price.changed',
    event_version: 'v1',
    producer: 'pricing-service',
    priority: EventPriority.CRITICAL,
    payload: {
      product_id: priceChange.productId,
      sku: priceChange.sku,
      changed_at: new Date().toISOString(),
      previous_price: priceChange.oldPrice,
      new_price: priceChange.newPrice,
      price_type: 'base_price',
      currency: 'EUR',
      affects_active_quotes: true,
      requote_required: false
    }
  });

  await outboxRepo.insert(envelope);
}
```

### 4.5 Price Cache Invalidation

When `price.changed` event is received:

1. **Immediate**: Invalidate cache for affected product/variant
2. **Secondary**: Invalidate all variant prices if base price changed
3. **Related**: Mark affected quotes for repricing
4. **Analytics**: Record price change for historical tracking

### 4.6 Required Actions

| Priority | Action | Target Date |
|----------|---------|-------------|
| P0 | Implement price.changed event consumer | 2026-03-01 |
| P0 | Set up price cache invalidation logic | 2026-03-01 |
| P1 | Implement promotion event publishing | 2026-03-15 |
| P1 | Add pricing analytics integration | 2026-03-15 |
| P2 | Implement dynamic pricing rules engine | 2026-04-01 |

---

## 5. Handoff to AI7 (Checkout)

### 5.1 Responsibilities

AI7 team is responsible for:

- Shopping cart management and persistence
- Checkout flow orchestration
- Order creation from carts/quotes
- Cart event publishing

### 5.2 Checkout/Cart Module Structure

```
checkout/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Cart.ts
│   │   │   ├── CartItem.ts
│   │   │   └── CartTotals.ts
│   │   └── services/
│   │       └── CartCalculationService.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── AddToCart.ts
│   │   │   ├── UpdateCartItem.ts
│   │   │   ├── RemoveFromCart.ts
│   │   │   ├── ApplyCoupon.ts
│   │   │   └── CreateOrderFromCart.ts
│   │   └── dtos/
│   │       └── cart.dtos.ts
│   └── api/
│       ├── controllers/
│       │   └── CartController.ts
│       └── routes/
│           └── cart.routes.ts
└── tests/
```

### 5.3 Event Publishing: Cart Updated

#### Event Schema

Schema: `/opt/cypher-erp/events/schemas/cart/cart-updated-v1.json`

#### Required to Publish: `cart.updated` events

#### Publishing Example

```typescript
import { EventEnvelopeFactory, EventPriority } from '@cypher/events';

async function onCartUpdate(cartId: string, action: CartAction, item?: CartItem) {
  const envelope = EventEnvelopeFactory.create({
    event_type: 'cart.updated',
    event_version: 'v1',
    producer: 'checkout-service',
    priority: EventPriority.NORMAL,
    payload: {
      cart_id: cartId,
      user_id: getCurrentUserId(),
      action: action, // 'item_added', 'item_removed', 'quantity_updated', etc.
      updated_at: new Date().toISOString(),
      items: await getCartItems(cartId),
      changed_item: item,
      totals: await calculateCartTotals(cartId)
    }
  });

  await outboxRepo.insert(envelope);
}
```

### 5.4 Event Consumption

The checkout module should consume these events:

| Event | Queue | When to Consume |
|-------|--------|-----------------|
| `price.changed` | `q.{env}.checkout-worker.price-changed` | Update cart prices on price change |
| `stock.changed` | `q.{env}.checkout-worker.stock-changed` | Validate cart item availability |
| `product.updated` | `q.{env}.checkout-worker.product-updated` | Update cart item details |
| `order.created` | `q.{env}.checkout-worker.order-created` | Clear cart after order creation |

#### Cart Price Update Example

```typescript
async function onPriceChanged(envelope: EventEnvelope): Promise<void> {
  const payload = envelope.payload;

  // Find all carts containing this product
  const affectedCarts = await findCartsByProductId(payload.product_id);

  for (const cart of affectedCarts) {
    // Update item price in cart
    await updateCartItemPrice(cart.id, payload.product_id, payload.new_price);

    // Recalculate cart totals
    await recalculateCartTotals(cart.id);

    // Emit cart.updated event
    await publishCartUpdatedEvent(cart.id, 'price_updated');
  }
}
```

### 5.5 Checkout Flow Events

When converting cart to order, emit:

```typescript
// 1. Emit order.created event (after order is persisted)
const orderEnvelope = EventEnvelopeFactory.create({
  event_type: 'order.created',
  event_version: 'v1',
  producer: 'checkout-service',
  priority: EventPriority.CRITICAL,
  correlation_id: cartId,
  payload: orderPayload
});

await outboxRepo.insert(orderEnvelope);

// 2. Emit cart.updated event with cleared action
const cartEnvelope = EventEnvelopeFactory.create({
  event_type: 'cart.updated',
  event_version: 'v1',
  producer: 'checkout-service',
  priority: EventPriority.NORMAL,
  causation_id: orderEnvelope.event_id,
  correlation_id: cartId,
  payload: {
    cart_id: cartId,
    action: 'cart_cleared',
    updated_at: new Date().toISOString()
  }
});

await outboxRepo.insert(cartEnvelope);
```

### 5.6 Required Actions

| Priority | Action | Target Date |
|----------|---------|-------------|
| P0 | Implement cart.updated event publishing | 2026-03-01 |
| P0 | Implement price.changed event consumption | 2026-03-01 |
| P0 | Implement order.created event publishing | 2026-03-01 |
| P1 | Implement stock validation before checkout | 2026-03-15 |
| P1 | Add cart analytics events | 2026-03-15 |
| P2 | Implement multi-cart support | 2026-04-01 |

---

## 6. Handoff to AI8 (Credit)

### 6.1 Responsibilities

AI8 team is responsible for:

- Customer credit management and limits
- Credit approval workflows
- B2B payment terms management
- Credit change event consumption and publishing

### 6.2 Credit Module Structure

```
credit/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── CreditAccount.ts
│   │   │   ├── CreditLimit.ts
│   │   │   └── CreditTransaction.ts
│   │   └── services/
│   │       ├── CreditCalculationService.ts
│   │       └── CreditApprovalService.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── GetCreditBalance.ts
│   │   │   ├── UpdateCreditLimit.ts
│   │   │   ├── RecordPayment.ts
│   │   │   └── CheckCreditAvailable.ts
│   │   └── dtos/
│   │       └── credit.dtos.ts
│   └── api/
│       ├── controllers/
│       │   └── CreditController.ts
│       └── routes/
│           └── credit.routes.ts
└── tests/
```

### 6.3 Event Publishing: Credit Changed

#### Event Schema

Schema: `/opt/cypher-erp/events/schemas/credit/credit-changed-v1.json`

#### Required to Publish: `credit.changed` events

#### Publishing Example

```typescript
import { EventEnvelopeFactory, EventPriority } from '@cypher/events';

async function onCreditUpdate(creditChange: CreditChange) {
  const envelope = EventEnvelopeFactory.create({
    event_type: 'credit.changed',
    event_version: 'v1',
    producer: 'credit-service',
    priority: EventPriority.CRITICAL,
    payload: {
      customer_id: creditChange.customerId,
      customer_type: 'b2b',
      change_type: creditChange.type,
      changed_at: new Date().toISOString(),
      changed_by: creditChange.userId,
      previous_credit_limit: creditChange.oldLimit,
      new_credit_limit: creditChange.newLimit,
      credit_limit: creditChange.newLimit,
      available_credit: await calculateAvailableCredit(creditChange.customerId),
      credit_utilization: await calculateCreditUtilization(creditChange.customerId),
      currency: 'EUR',
      payment_term: creditChange.paymentTerm
    }
  });

  await outboxRepo.insert(envelope);
}
```

### 6.4 Event Consumption

The credit module should consume these events:

| Event | Queue | When to Consume |
|-------|--------|-----------------|
| `order.created` | `q.{env}.credit-worker.order-created` | Deduct from available credit |
| `order.cancelled` | `q.{env}.credit-worker.order-cancelled` | Restore credit |
| `order.paid` | `q.{env}.credit-worker.order-paid` | Record payment |
| `invoice.issued` | `q.{env}.credit-worker.invoice-issued` | Increase balance |

#### Order Credit Deduction Example

```typescript
async function onOrderCreated(envelope: EventEnvelope): Promise<void> {
  const payload = envelope.payload;

  // Only process B2B orders
  if (payload.customer_type !== 'b2b') {
    return;
  }

  // Get customer credit account
  const creditAccount = await getCreditAccount(payload.customer_id);

  // Calculate order total
  const orderTotal = payload.totals.total;

  // Check if sufficient credit
  if (creditAccount.available_credit < orderTotal) {
    // Reject order or require alternative payment
    await rejectOrderForCredit(payload.order_id, 'INSUFFICIENT_CREDIT');
    return;
  }

  // Deduct from available credit (not from limit, from available)
  await reserveCredit(payload.customer_id, orderTotal, payload.order_id);

  // Emit credit.changed event
  await publishCreditChangedEvent({
    customerId: payload.customer_id,
    type: 'balance_decreased',
    previousBalance: creditAccount.balance,
    newBalance: creditAccount.balance,
    balanceChangeAmount: orderTotal
  });
}
```

### 6.5 Credit Approval Workflow

When credit limit increase is requested:

```typescript
async function processCreditLimitIncrease(request: CreditLimitRequest): Promise<void> {
  // 1. Check customer history
  const history = await getPaymentHistory(request.customerId);

  // 2. Calculate risk score
  const riskScore = await calculateRiskScore(history, request.newLimit);

  // 3. Approve or reject based on rules
  if (riskScore > RISK_THRESHOLD) {
    await rejectRequest(request.id, 'HIGH_RISK');
    return;
  }

  // 4. Update credit limit
  await updateCreditLimit(request.customerId, request.newLimit);

  // 5. Emit credit.changed event
  await publishCreditChangedEvent({
    customerId: request.customerId,
    type: 'credit_limit_increased',
    previousCreditLimit: request.oldLimit,
    newCreditLimit: request.newLimit,
    changedBy: request.approvedBy
  });

  // 6. Notify customer
  await sendNotification(request.customerId, 'CREDIT_LIMIT_APPROVED');
}
```

### 6.6 Payment Term Management

Supported payment terms:

| Term | Description | B2B Standard |
|------|-------------|---------------|
| `immediate` | Payment due on delivery | No |
| `net_7` | Payment due in 7 days | Yes |
| `net_14` | Payment due in 14 days | Yes |
| `net_30` | Payment due in 30 days | Yes (standard) |
| `net_60` | Payment due in 60 days | Yes |
| `net_90` | Payment due in 90 days | Yes |

### 6.7 Required Actions

| Priority | Action | Target Date |
|----------|---------|-------------|
| P0 | Implement credit.changed event publishing | 2026-03-01 |
| P0 | Implement order.created event consumption | 2026-03-01 |
| P0 | Implement order.cancelled event consumption | 2026-03-01 |
| P1 | Implement credit approval workflow | 2026-03-15 |
| P1 | Add credit scoring and risk assessment | 2026-03-15 |
| P2 | Implement automated credit limit adjustments | 2026-04-01 |

---

## 7. Handoff to AI9 (Catalog)

### 7.1 Responsibilities

AI9 team is responsible for:

- Product catalog management
- Product and variant management
- Category and taxonomy management
- Product event consumption and publishing

### 7.2 Catalog Module Structure

```
catalog/
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── Product.ts
│   │   │   ├── ProductVariant.ts
│   │   │   ├── Category.ts
│   │   │   └── ProductAttribute.ts
│   │   └── services/
│   │       ├── ProductService.ts
│   │       └── CategoryService.ts
│   ├── application/
│   │   ├── use-cases/
│   │   │   ├── CreateProduct.ts
│   │   │   ├── UpdateProduct.ts
│   │   │   ├── CreateVariant.ts
│   │   │   └── ManageCategories.ts
│   │   └── dtos/
│   │       └── catalog.dtos.ts
│   ├── infrastructure/
│   │   ├── repositories/
│   │   │   ├── ProductRepository.ts
│   │   │   └── CategoryRepository.ts
│   │   └── cache/
│   │       └── ProductCache.ts
│   └── api/
│       ├── controllers/
│       │   └── CatalogController.ts
│       └── routes/
│           └── catalog.routes.ts
└── tests/
```

### 7.3 Event Publishing: Product Updated

#### Event Schema

Schema: `/opt/cypher-erp/events/schemas/product/product-updated-v1.json`

#### Required to Publish: `product.updated` events

#### Publishing Example

```typescript
import { EventEnvelopeFactory, EventPriority } from '@cypher/events';

async function onProductUpdate(product: Product, changeType: string) {
  const envelope = EventEnvelopeFactory.create({
    event_type: 'product.updated',
    event_version: 'v1',
    producer: 'catalog-service',
    priority: EventPriority.NORMAL,
    payload: {
      product_id: product.id,
      sku: product.sku,
      updated_at: new Date().toISOString(),
      updated_by: getCurrentUserId(),
      change_type: changeType, // 'name_changed', 'description_changed', etc.
      previous_values: extractChangedFields(product, changeType),
      new_values: extractNewValues(product, changeType),
      product: {
        id: product.id,
        name: product.name,
        status: product.status,
        visibility: product.visibility,
        // ... other product fields
      }
    }
  });

  await outboxRepo.insert(envelope);
}
```

### 7.4 Event Consumption

The catalog module should consume these events:

| Event | Queue | When to Consume |
|-------|--------|-----------------|
| `stock.changed` | `q.{env}.catalog-worker.stock-changed` | Update product stock status |
| `price.changed` | `q.{env}.catalog-worker.price-changed` | Update product prices in cache |
| `product.created` | (internal) | Sync to search/index |

#### Stock Status Update Example

```typescript
async function onStockChanged(envelope: EventEnvelope): Promise<void> {
  const payload = envelope.payload;

  // Find product
  const product = await getProductBySku(payload.sku);

  if (!product) {
    return;
  }

  // Update stock status based on new quantity
  let stockStatus: StockStatus = 'in_stock';
  if (payload.new_quantity === 0) {
    stockStatus = 'out_of_stock';
  } else if (payload.new_quantity < payload.threshold_low_stock) {
    stockStatus = 'low_stock';
  }

  // Update product
  await updateProductStockStatus(product.id, stockStatus, payload.new_quantity);

  // Emit product.updated event for cache invalidation
  await publishProductUpdatedEvent(product.id, 'stock_status_changed');
}
```

### 7.5 Product-Price Synchronization

When `price.changed` event is received:

1. **Identify affected products**: By product_id or variant_id
2. **Update pricing database**: With new price values
3. **Invalidate cache**: Remove from product cache
4. **Trigger reindex**: Queue for search index update

```typescript
async function onPriceChanged(envelope: EventEnvelope): Promise<void> {
  const payload = envelope.payload;

  // Update price in product database
  if (payload.variant_id) {
    await updateVariantPrice(payload.variant_id, payload.new_price);
  } else {
    await updateProductPrice(payload.product_id, payload.new_price);
  }

  // Invalidate product cache
  await invalidateProductCache(payload.product_id);

  // Trigger search reindex
  await queueSearchReindex(payload.product_id);

  // Notify external systems if needed
  if (payload.affects_active_quotes) {
    await notifyPricingService(payload);
  }
}
```

### 7.6 Category Management Events

Catalog should publish category events:

| Event | When to Publish | Priority |
|-------|----------------|----------|
| `category.created` | When new category is created | normal |
| `category.updated` | When category is modified | normal |
| `category.deleted` | When category is removed | normal |

### 7.7 Required Actions

| Priority | Action | Target Date |
|----------|---------|-------------|
| P0 | Implement product.updated event publishing | 2026-03-01 |
| P0 | Implement stock.changed event consumption | 2026-03-01 |
| P0 | Implement price.changed event consumption | 2026-03-01 |
| P1 | Implement category event publishing | 2026-03-15 |
| P1 | Set up product search synchronization | 2026-03-15 |
| P2 | Implement bulk product import events | 2026-04-01 |

---

## 8. Event Contracts Summary

### 8.1 All Defined Events

| Event Type | Schema File | Version | Publisher | Consumer(s) | Priority |
|-------------|---------------|----------|-----------|--------------|----------|
| `common.envelope` | `/schemas/common/envelope-v1.json` | v1 | N/A | N/A |
| `cart.updated` | `/schemas/cart/cart-updated-v1.json` | v1 | checkout-service | normal |
| `quote.created` | `/schemas/quote/quote-created-v1.json` | v1 | checkout-service | normal |
| `order.created` | `/schemas/order/order-created-v1.json` | v1 | checkout-service, orders, notification, erp-sync | critical |
| `order.cancelled` | `/schemas/order/order-cancelled-v1.json` | v1 | orders, credit, inventory | critical |
| `credit.changed` | `/schemas/credit/credit-changed-v1.json` | v1 | credit-service | critical |
| `product.updated` | `/schemas/product/product-updated-v1.json` | v1 | catalog-service, search | normal |
| `stock.changed` | `/schemas/stock/stock-changed-v1.json` | v1 | inventory, catalog, checkout | critical |
| `price.changed` | `/schemas/price/price-changed-v1.json` | v1 | pricing, catalog, checkout, search | critical |

### 8.2 Event Envelope Structure

All events are wrapped in the standard envelope:

```typescript
interface EventEnvelope<TPayload = any> {
  // Identification
  event_id: string;           // UUID v4
  event_type: string;         // Format: domain.action
  event_version: string;       // Format: v{number}

  // Timing
  occurred_at: string;         // ISO 8601 timestamp

  // Producer
  producer: string;           // Service name
  producer_version?: string;    // Service version
  producer_instance?: string;  // Instance ID

  // Tracing
  correlation_id: string;       // UUID for grouping
  causation_id?: string;       // ID of causing event
  parent_event_id?: string;    // Parent in hierarchy
  trace_id?: string;          // Distributed trace

  // Routing
  routing_key?: string;       // RabbitMQ routing key

  // Priority
  priority: EventPriority;     // low, normal, high, critical

  // Content
  payload: TPayload;          // Event-specific data

  // Metadata
  metadata?: {
    user_id?: string;
    session_id?: string;
    ip_address?: string;
    user_agent?: string;
    tenant_id?: string;
  };
}
```

### 8.3 Schema Validation

#### Using Schema Registry

```typescript
import { SchemaRegistry, initializeEvents } from '@cypher/events';

// Initialize on service startup
const registry = await initializeEvents({
  schemasDir: '/opt/cypher-erp/events/schemas'
});

// Validate event before processing
const validation = await registry.validateEvent(envelope);
if (!validation.valid) {
  console.error('Event validation failed:', validation.errors);
  // Move to DLQ or reject
}
```

#### Schema Registry API

| Method | Purpose |
|---------|----------|
| `validateEvent(envelope)` | Validate envelope and payload |
| `getSchema(eventType, version)` | Get schema by type and version |
| `getLatestVersion(eventType)` | Get latest version of event schema |
| `listSchemas({ eventType })` | List all schemas or by type |
| `getStats()` | Get registry statistics |

### 8.4 Event Naming Convention

Events follow the pattern: `{domain}.{action}`

| Domain | Actions | Examples |
|---------|----------|-----------|
| `cart` | created, updated, cleared, item_added, item_removed | `cart.updated`, `cart.item_added` |
| `quote` | created, updated, accepted, rejected, expired | `quote.created`, `quote.accepted` |
| `order` | created, updated, cancelled, paid, shipped, delivered | `order.created`, `order.shipped` |
| `credit` | changed, limit_adjusted, payment_received | `credit.changed`, `credit.payment_received` |
| `product` | created, updated, deleted, price_updated | `product.updated`, `product.created` |
| `stock` | changed, reserved, released, adjusted | `stock.changed`, `stock.reserved` |
| `price` | changed, promotion_started, promotion_ended | `price.changed`, `price.promotion_started` |

---

## 9. Deployment Checklist

### 9.1 Pre-Deployment

| Item | Checked By | Date | Notes |
|-------|-------------|-------|-------|
| Event schemas reviewed and validated | | |
| RabbitMQ topology applied to all environments | | |
| Outbox relay deployed and running | | |
| Consumer services registered with health check | | |
| Monitoring and alerting configured | | |
| Documentation updated | | |
| Rollback plan documented | | |

### 9.2 Environment Variables

Required for all services:

```bash
# RabbitMQ Connection
RABBITMQ_URL=amqp://admin:password@rabbitmq:5672
RABBITMQ_VHOST=cypher.prod

# Schema Registry
EVENT_SCHEMAS_DIR=/opt/cypher-erp/events/schemas

# Outbox (for publishers)
OUTBOX_ENABLED=true
OUTBOX_BATCH_SIZE=50
OUTBOX_BATCH_INTERVAL_MS=5000
```

### 9.3 Deployment Steps

#### 1. RabbitMQ Topology

```bash
cd /opt/cypher-erp/infrastructure/rabbitmq

# Dev environment
terraform plan -var-file="env/dev.tfvars"
terraform apply -var-file="env/dev.tfvars"

# Production environment
terraform plan -var-file="env/prod.tfvars"
terraform apply -var-file="env/prod.tfvars"
```

#### 2. Schema Registry

```bash
# No deployment needed - schemas are loaded at runtime
# Verify schema registry can initialize
node -e "
const { initializeEvents } = require('@cypher/events');
initializeEvents().then(() => console.log('OK')).catch(e => console.error(e));
"
```

#### 3. Outbox Relay

```bash
cd /opt/cypher-erp

# Build outbox relay
npm run build:outbox-relay

# Deploy
docker compose up -d outbox-relay

# Verify health
curl http://localhost:3010/health
```

#### 4. Consumer Services

Each consumer service follows this pattern:

```bash
cd /opt/cypher-erp/modules/{module}

# Build
npm run build

# Run
npm run start:consumer
```

### 9.4 Health Checks

All services must implement `/health` endpoint:

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "components": {
    "rabbitmq": { "status": "healthy" },
    "postgres": { "status": "healthy" },
    "service": { "status": "healthy" }
  },
  "uptime": 3600000
}
```

### 9.5 Monitoring Integration

#### Prometheus Scrape Config

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'outbox-relay'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['outbox-relay:3010']
```

#### Grafana Dashboard Import

1. Import dashboard JSON from `/opt/cypher-erp/infrastructure/rabbitmq/grafana/dashboards/`
2. Set datasource to Prometheus
3. Review panel configurations
4. Set up alerts

### 9.6 Rollback Procedure

If deployment fails:

```bash
# 1. Stop services
docker compose stop

# 2. Revert code
git revert <commit-hash>

# 3. Rebuild and redeploy
npm run build
docker compose up -d

# 4. Verify health
curl http://localhost:3000/health

# 5. Check RabbitMQ queues
rabbitmqadmin list queues name messages consumers
```

### 9.7 Post-Deployment

| Item | Checked By | Date | Notes |
|-------|-------------|-------|-------|
| All services healthy | | |
| Event flow verified | | |
| DLQ empty (no stuck messages) | | |
| Monitoring receiving metrics | | |
| First events processed successfully | | |
| Performance within SLA | | |

---

## 10. Contact Information

### 10.1 Team Contacts

| Team | Lead | Email | Slack | Responsibility |
|-------|-------|--------|-------|-----------------|
| Events (Architecture) | TBD | events@cypher.ro | #events | Overall architecture and governance |
| AI1 (Infrastructure) | TBD | infra@cypher.ro | #infra | RabbitMQ, monitoring, disaster recovery |
| AI4 (Jobs) | TBD | jobs@cypher.ro | #jobs | Outbox relay, background jobs |
| AI6 (Pricing) | TBD | pricing@cypher.ro | #pricing | Pricing engine, discounts |
| AI7 (Checkout) | TBD | checkout@cypher.ro | #checkout | Cart, checkout flow |
| AI8 (Credit) | TBD | credit@cypher.ro | #credit | B2B credit, payment terms |
| AI9 (Catalog) | TBD | catalog@cypher.ro | #catalog | Products, categories, variants |

### 10.2 Emergency Contacts

| Issue | Contact | Procedure |
|-------|----------|-----------|
| RabbitMQ Cluster Down | #infra-oncall | 1. Check cluster status 2. Verify network 3. Trigger failover |
| High DLQ Buildup | #jobs-oncall | 1. Review DLQ messages 2. Identify root cause 3. Implement fix 4. Reprocess messages |
| Schema Validation Failures | #events-oncall | 1. Check schema registry 2. Verify event publisher 3. Update consumers if needed |
| Service Outage | #oncall | Follow incident response procedure |

### 10.3 Documentation Links

| Resource | URL | Description |
|----------|-----|-------------|
| Event Governance | https://docs.cypher.ro/events/governance | Event naming, versioning, deprecation |
| API Reference | https://docs.cypher.ro/api/events | Event schema reference |
| Infrastructure Guide | https://docs.cypher.ro/infrastructure | RabbitMQ setup and management |
| Outbox Pattern | https://docs.cypher.ro/patterns/outbox | Outbox implementation guide |
| Monitoring | https://grafana.cypher.ro | Production dashboards |

### 10.4 On-Call Rotation

| Week | Primary | Backup |
|-------|----------|---------|
| Week 1 | TBD | TBD |
| Week 2 | TBD | TBD |
| Week 3 | TBD | TBD |
| Week 4 | TBD | TBD |

---

## Appendix A: Event Schema Examples

### A.1 Order Created

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "order.created",
  "event_version": "v1",
  "occurred_at": "2026-02-13T12:00:00.000Z",
  "producer": "checkout-service",
  "producer_version": "1.0.0",
  "correlation_id": "660e8400-e29b-41d4-a716-446655440001",
  "routing_key": "order.created.v1",
  "priority": "critical",
  "payload": {
    "order_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "order_number": "ORD-00012345",
    "customer_id": "CUST-00123",
    "customer_type": "b2b",
    "created_at": "2026-02-13T12:00:00.000Z",
    "status": "pending",
    "payment_status": "pending",
    "fulfillment_status": "unfulfilled",
    "items": [
      {
        "item_id": "f1e2d3c4-b5a6-9876-fedc-987654321098",
        "product_id": "PRD-001",
        "sku": "PRD-001",
        "quantity": 10,
        "unit_price": 150.00,
        "line_total": 1500.00
      }
    ],
    "totals": {
      "subtotal": 1500.00,
      "tax_amount": 285.00,
      "total": 1785.00,
      "currency": "EUR"
    }
  }
}
```

### A.2 Stock Changed

```json
{
  "event_id": "550e8400-e29b-41d4-a716-4466554400001",
  "event_type": "stock.changed",
  "event_version": "v1",
  "occurred_at": "2026-02-13T12:00:00.000Z",
  "producer": "inventory-service",
  "priority": "critical",
  "payload": {
    "product_id": "PRD-00123",
    "sku": "PRD-001-A",
    "changed_at": "2026-02-13T12:00:00.000Z",
    "changed_by": "system",
    "change_type": "order_reserved",
    "quantity_change": -10,
    "previous_quantity": 50,
    "new_quantity": 40,
    "new_available": 40,
    "stock_status": "in_stock"
  }
}
```

### A.3 Price Changed

```json
{
  "event_id": "550e8400-e29b-41d4-a716-4466554400002",
  "event_type": "price.changed",
  "event_version": "v1",
  "occurred_at": "2026-02-13T12:00:00.000Z",
  "producer": "pricing-service",
  "priority": "critical",
  "payload": {
    "product_id": "PRD-00123",
    "sku": "PRD-001-A",
    "changed_at": "2026-02-13T12:00:00.000Z",
    "changed_by": "user-456",
    "price_type": "base_price",
    "previous_price": 150.00,
    "new_price": 165.00,
    "price_difference": 15.00,
    "percentage_change": 10,
    "currency": "EUR",
    "affects_active_quotes": true,
    "requote_required": true,
    "channels_affected": ["web", "mobile", "pos", "b2b_portal"]
  }
}
```

---

## Appendix B: Troubleshooting Guide

### B.1 Common Issues

| Issue | Symptoms | Cause | Resolution |
|--------|------------|--------|------------|
| Events not reaching consumers | Queue depth increasing, no ACKs | Wrong routing key or binding missing | Verify bindings in RabbitMQ UI |
| Duplicate events | Same event_id processed multiple times | Consumer not ACKing properly | Ensure ACK is called after successful processing |
| Events lost | No records in DLQ or processed | Producer confirm disabled | Enable publisher confirms in outbox |
| DLQ filling up | Messages in DLQ | Consumer errors or schema mismatch | Check DLQ messages, fix consumer, republish |
| High latency | Events processed slowly | Consumer bottleneck | Scale consumers, optimize processing |

### B.2 Debug Commands

```bash
# Check queue depth
rabbitmqadmin list queues name messages messages_unacked

# Get queue details
rabbitmqadmin list queues name messages_ready consumers

# List bindings
rabbitmqadmin list bindings source destination routing_key

# Get connection count
rabbitmqadmin list connections

# Monitor message rates
rabbitmqadmin list channels name messages_published
```

### B.3 Event Replay

If events need to be replayed:

```bash
# 1. Pause consumers
rabbitmqadmin delete queue name=q.{env}.{service}.{event}

# 2. Populate queue from outbox replay
# (custom script required)

# 3. Resume consumers
# (consumers will auto-reconnect)
```

---

## Change History

| Version | Date | Author | Changes |
|---------|-------|---------|----------|
| 1.0.0 | 2026-02-13 | Initial handoff package |

---

This document is maintained by the Events Team. For updates, submit pull requests to the documentation repository.
