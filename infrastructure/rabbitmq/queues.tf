# ==============================================================================
# Cypher ERP - RabbitMQ Event Bus
# Queue Definitions
#
# Description:
#   This file defines all consumer queues in the Cypher ERP event bus.
#   Each queue is configured with Dead Letter Exchange (DLX) support for
#   reliable message handling and error recovery.
#
# Queue Naming Convention:
#   q.{worker-service}.{event-type}
#
# Features:
#   - Durable: Survives broker restarts
#   - DLX: Failed messages go to dead letter exchange
#   - TTL: Messages expire after configured time (for cleanup)
#
# ==============================================================================

# ==============================================================================
# Search Indexer Queue
# ==============================================================================
# Purpose: Updates Elasticsearch index when products change
# Event: product.updated
# Worker: search-indexer-service
#
# Message Flow:
#   1. Publisher sends product.updated to events exchange
#   2. Queue receives and processes
#   3. On failure -> Retry Exchange -> DLQ
# ==============================================================================

resource "rabbitmq_queue" "search_indexer_product_updated" {
  name  = "${local.prefix}.search-indexer.product-updated"
  durable = true
  auto_delete = false

  # Send failed messages to DLQ exchange
  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.dlq
  }

  # Use original routing key when sending to DLQ
  arguments {
    key   = "x-dead-letter-routing-key"
    value = "product.updated"
  }

  # Message TTL for cleanup (24 hours)
  arguments {
    key   = "x-message-ttl"
    value = local.queue_ttls.search_indexer
  }

  # Max length (prevent queue explosion)
  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "domain"
    value = "search"
  }

  tags {
    name  = "worker"
    value = "search-indexer"
  }

  tags {
    name  = "event"
    value = "product.updated"
  }
}

# ==============================================================================
# Pricing Worker Queue
# ==============================================================================
# Purpose: Updates pricing tables when prices change
# Event: price.changed
# Worker: pricing-worker-service
#
# Message Flow:
#   1. Publisher sends price.changed to events exchange
#   2. Queue receives and processes
#   3. On failure -> Retry Exchange -> DLQ
# ==============================================================================

resource "rabbitmq_queue" "pricing_worker_price_changed" {
  name  = "${local.prefix}.pricing-worker.price-changed"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.dlq
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "price.changed"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.queue_ttls.pricing_worker
  }

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "domain"
    value = "pricing"
  }

  tags {
    name  = "worker"
    value = "pricing-worker"
  }

  tags {
    name  = "event"
    value = "price.changed"
  }
}

# ==============================================================================
# Notification Worker Queue
# ==============================================================================
# Purpose: Sends customer notifications for new orders
# Event: order.created
# Worker: notification-worker-service
#
# Message Flow:
#   1. Publisher sends order.created to events exchange
#   2. Queue receives and processes (sends email/SMS)
#   3. On failure -> Retry Exchange -> DLQ
# ==============================================================================

resource "rabbitmq_queue" "notification_worker_order_created" {
  name  = "${local.prefix}.notification-worker.order-created"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.dlq
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.created"
  }

  # Longer TTL for notifications (7 days) - don't lose customer comms
  arguments {
    key   = "x-message-ttl"
    value = local.queue_ttls.notification
  }

  arguments {
    key   = "x-max-length"
    value = 500000
  }

  tags {
    name  = "domain"
    value = "notification"
  }

  tags {
    name  = "worker"
    value = "notification-worker"
  }

  tags {
    name  = "event"
    value = "order.created"
  }
}

# ==============================================================================
# Credit Worker Queue
# ==============================================================================
# Purpose: Handles credit allocation when orders are cancelled
# Event: order.cancelled
# Worker: credit-worker-service
#
# Message Flow:
#   1. Publisher sends order.cancelled to events exchange
#   2. Queue receives and processes (restores credit)
#   3. On failure -> Retry Exchange -> DLQ
# ==============================================================================

resource "rabbitmq_queue" "credit_worker_order_cancelled" {
  name  = "${local.prefix}.credit-worker.order-cancelled"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.dlq
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.cancelled"
  }

  # Shorter TTL for financial operations (12 hours)
  arguments {
    key   = "x-message-ttl"
    value = local.queue_ttls.credit_worker
  }

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "domain"
    value = "credit"
  }

  tags {
    name  = "worker"
    value = "credit-worker"
  }

  tags {
    name  = "event"
    value = "order.cancelled"
  }
}

# ==============================================================================
# ERP Sync Queue
# ==============================================================================
# Purpose: Synchronizes orders to external ERP system
# Event: order.created
# Worker: erp-sync-service
#
# Message Flow:
#   1. Publisher sends order.created to events exchange
#   2. Queue receives and processes (syncs to ERP)
#   3. On failure -> Retry Exchange -> DLQ
# ==============================================================================

resource "rabbitmq_queue" "erp_sync_order_created" {
  name  = "${local.prefix}.erp-sync.order-created"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.dlq
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.created"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.queue_ttls.erp_sync
  }

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "domain"
    value = "erp"
  }

  tags {
    name  = "worker"
    value = "erp-sync"
  }

  tags {
    name  = "event"
    value = "order.created"
  }
}

# ==============================================================================
# Queue Summary
# ==============================================================================
# Total Queues: 5
#
# Queue                          | Event           | Worker            | Max TTL
# ------------------------------|-----------------|-------------------|--------
# q.search-indexer.product-upd   | product.updated | search-indexer    | 24h
# q.pricing-worker.price-changed | price.changed   | pricing-worker    | 24h
# q.notification.order-created   | order.created   | notification-worker| 7d
# q.credit-worker.order-cancel  | order.cancelled | credit-worker     | 12h
# q.erp-sync.order-created       | order.created   | erp-sync          | 24h
# ==============================================================================
