# ==============================================================================
# Cypher ERP - RabbitMQ Event Bus
# Retry Queue Configuration
#
# Description:
#   This file implements the retry mechanism with exponential backoff for failed
#   messages. The retry pattern allows messages to be automatically retried with
#   increasing delays between attempts before being sent to DLQ.
#
# Retry Pattern:
#   1. Message fails processing in main queue
#   2. Published to retry exchange with routing key {event}.retry.{attempt}
#   3. Retry queue expires message after configured TTL
#   4. DLX forwards expired message back to main events exchange
#   5. Message is reprocessed by worker queue
#   6. If fails again, increment attempt counter and repeat
#   7. After max attempts, send to DLQ
#
# ==============================================================================

# ==============================================================================
# Retry Queues - product.updated
# ==============================================================================
# Purpose: Retry failed product update events
# TTL Strategy: 10s -> 60s -> 5min -> DLQ
# ==============================================================================

# Retry 1: 10 second delay
resource "rabbitmq_queue" "retry_product_updated_1" {
  name  = "${local.prefix}.retry.product.updated.1"
  durable = true
  auto_delete = false

  # After TTL expires, send back to main exchange
  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "product.updated"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_1
  }

  arguments {
    key   = "x-max-length"
    value = 50000
  }

  tags {
    name  = "retry-count"
    value = "1"
  }
}

# Retry 2: 60 second delay
resource "rabbitmq_queue" "retry_product_updated_2" {
  name  = "${local.prefix}.retry.product.updated.2"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "product.updated"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_2
  }

  arguments {
    key   = "x-max-length"
    value = 50000
  }

  tags {
    name  = "retry-count"
    value = "2"
  }
}

# Retry 3: 5 minute delay
resource "rabbitmq_queue" "retry_product_updated_3" {
  name  = "${local.prefix}.retry.product.updated.3"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "product.updated"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_3
  }

  arguments {
    key   = "x-max-length"
    value = 50000
  }

  tags {
    name  = "retry-count"
    value = "3"
  }
}

# ==============================================================================
# Retry Queues - price.changed
# ==============================================================================
# Purpose: Retry failed price change events
# TTL Strategy: 10s -> 60s -> 5min -> DLQ
# ==============================================================================

resource "rabbitmq_queue" "retry_price_changed_1" {
  name  = "${local.prefix}.retry.price.changed.1"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "price.changed"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_1
  }

  arguments {
    key   = "x-max-length"
    value = 50000
  }

  tags {
    name  = "retry-count"
    value = "1"
  }
}

resource "rabbitmq_queue" "retry_price_changed_2" {
  name  = "${local.prefix}.retry.price.changed.2"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "price.changed"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_2
  }

  arguments {
    key   = "x-max-length"
    value = 50000
  }

  tags {
    name  = "retry-count"
    value = "2"
  }
}

resource "rabbitmq_queue" "retry_price_changed_3" {
  name  = "${local.prefix}.retry.price.changed.3"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "price.changed"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_3
  }

  arguments {
    key   = "x-max-length"
    value = 50000
  }

  tags {
    name  = "retry-count"
    value = "3"
  }
}

# ==============================================================================
# Retry Queues - order.created
# ==============================================================================
# Purpose: Retry failed order creation events
# TTL Strategy: 10s -> 60s -> 5min -> DLQ
# ==============================================================================

resource "rabbitmq_queue" "retry_order_created_1" {
  name  = "${local.prefix}.retry.order.created.1"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.created"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_1
  }

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "retry-count"
    value = "1"
  }
}

resource "rabbitmq_queue" "retry_order_created_2" {
  name  = "${local.prefix}.retry.order.created.2"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.created"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_2
  }

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "retry-count"
    value = "2"
  }
}

resource "rabbitmq_queue" "retry_order_created_3" {
  name  = "${local.prefix}.retry.order.created.3"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.created"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_3
  }

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "retry-count"
    value = "3"
  }
}

# ==============================================================================
# Retry Queues - order.cancelled
# ==============================================================================
# Purpose: Retry failed order cancellation events
# TTL Strategy: 10s -> 60s -> 5min -> DLQ
# ==============================================================================

resource "rabbitmq_queue" "retry_order_cancelled_1" {
  name  = "${local.prefix}.retry.order.cancelled.1"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.cancelled"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_1
  }

  arguments {
    key   = "x-max-length"
    value = 50000
  }

  tags {
    name  = "retry-count"
    value = "1"
  }
}

resource "rabbitmq_queue" "retry_order_cancelled_2" {
  name  = "${local.prefix}.retry.order.cancelled.2"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.cancelled"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_2
  }

  arguments {
    key   = "x-max-length"
    value = 50000
  }

  tags {
    name  = "retry-count"
    value = "2"
  }
}

resource "rabbitmq_queue" "retry_order_cancelled_3" {
  name  = "${local.prefix}.retry.order.cancelled.3"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-dead-letter-exchange"
    value = local.exchange_names.events
  }

  arguments {
    key   = "x-dead-letter-routing-key"
    value = "order.cancelled"
  }

  arguments {
    key   = "x-message-ttl"
    value = local.retry_ttls.attempt_3
  }

  arguments {
    key   = "x-max-length"
    value = 50000
  }

  tags {
    name  = "retry-count"
    value = "3"
  }
}

# ==============================================================================
# DLQ Queues
# ==============================================================================
# Purpose: Final destination for messages that have exhausted retry attempts
# Usage: Inspect via Management UI, manually retry or investigate issues
# ==============================================================================

resource "rabbitmq_queue" "dlq_product_updated" {
  name  = "${local.prefix}.dlq.product.updated"
  durable = true
  auto_delete = false

  # DLQ messages have no expiry by default for inspection
  # Set a long TTL if needed for cleanup (e.g., 30 days)

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "purpose"
    value = "dead-letter-queue"
  }
}

resource "rabbitmq_queue" "dlq_price_changed" {
  name  = "${local.prefix}.dlq.price.changed"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "purpose"
    value = "dead-letter-queue"
  }
}

resource "rabbitmq_queue" "dlq_order_created" {
  name  = "${local.prefix}.dlq.order.created"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "purpose"
    value = "dead-letter-queue"
  }
}

resource "rabbitmq_queue" "dlq_order_cancelled" {
  name  = "${local.prefix}.dlq.order.cancelled"
  durable = true
  auto_delete = false

  arguments {
    key   = "x-max-length"
    value = 100000
  }

  tags {
    name  = "purpose"
    value = "dead-letter-queue"
  }
}

# ==============================================================================
# Retry Queue to Exchange Bindings
# ==============================================================================
# These bindings are used by workers to publish failed messages to retry queues
# The application logic determines which retry attempt to use
# ==============================================================================

# product.updated retry bindings
resource "rabbitmq_binding" "retry_product_updated_1" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_product_updated_1.name
  destination_type = "queue"
  routing_key      = "product.updated.retry.1"
}

resource "rabbitmq_binding" "retry_product_updated_2" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_product_updated_2.name
  destination_type = "queue"
  routing_key      = "product.updated.retry.2"
}

resource "rabbitmq_binding" "retry_product_updated_3" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_product_updated_3.name
  destination_type = "queue"
  routing_key      = "product.updated.retry.3"
}

# price.changed retry bindings
resource "rabbitmq_binding" "retry_price_changed_1" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_price_changed_1.name
  destination_type = "queue"
  routing_key      = "price.changed.retry.1"
}

resource "rabbitmq_binding" "retry_price_changed_2" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_price_changed_2.name
  destination_type = "queue"
  routing_key      = "price.changed.retry.2"
}

resource "rabbitmq_binding" "retry_price_changed_3" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_price_changed_3.name
  destination_type = "queue"
  routing_key      = "price.changed.retry.3"
}

# order.created retry bindings
resource "rabbitmq_binding" "retry_order_created_1" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_order_created_1.name
  destination_type = "queue"
  routing_key      = "order.created.retry.1"
}

resource "rabbitmq_binding" "retry_order_created_2" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_order_created_2.name
  destination_type = "queue"
  routing_key      = "order.created.retry.2"
}

resource "rabbitmq_binding" "retry_order_created_3" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_order_created_3.name
  destination_type = "queue"
  routing_key      = "order.created.retry.3"
}

# order.cancelled retry bindings
resource "rabbitmq_binding" "retry_order_cancelled_1" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_order_cancelled_1.name
  destination_type = "queue"
  routing_key      = "order.cancelled.retry.1"
}

resource "rabbitmq_binding" "retry_order_cancelled_2" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_order_cancelled_2.name
  destination_type = "queue"
  routing_key      = "order.cancelled.retry.2"
}

resource "rabbitmq_binding" "retry_order_cancelled_3" {
  source           = local.exchange_names.retry
  vhost            = "/"
  destination      = rabbitmq_queue.retry_order_cancelled_3.name
  destination_type = "queue"
  routing_key      = "order.cancelled.retry.3"
}

# DLQ bindings
resource "rabbitmq_binding" "dlq_product_updated" {
  source           = local.exchange_names.dlq
  vhost            = "/"
  destination      = rabbitmq_queue.dlq_product_updated.name
  destination_type = "queue"
  routing_key      = "product.updated"
}

resource "rabbitmq_binding" "dlq_price_changed" {
  source           = local.exchange_names.dlq
  vhost            = "/"
  destination      = rabbitmq_queue.dlq_price_changed.name
  destination_type = "queue"
  routing_key      = "price.changed"
}

resource "rabbitmq_binding" "dlq_order_created" {
  source           = local.exchange_names.dlq
  vhost            = "/"
  destination      = rabbitmq_queue.dlq_order_created.name
  destination_type = "queue"
  routing_key      = "order.created"
}

resource "rabbitmq_binding" "dlq_order_cancelled" {
  source           = local.exchange_names.dlq
  vhost            = "/"
  destination      = rabbitmq_queue.dlq_order_cancelled.name
  destination_type = "queue"
  routing_key      = "order.cancelled"
}

# ==============================================================================
# Retry Configuration Summary
# ==============================================================================
# Total Retry Queues: 12 (3 levels x 4 events)
# Total DLQ Queues: 4
# Total Retry Bindings: 12
# Total DLQ Bindings: 4
#
# Retry TTL Configuration:
#   Attempt 1: 10 seconds
#   Attempt 2: 60 seconds (1 minute)
#   Attempt 3: 300 seconds (5 minutes)
#   After attempt 3: Message goes to DLQ
#
# Events with retry support:
#   - product.updated
#   - price.changed
#   - order.created
#   - order.cancelled
#
# Application Responsibility:
#   Workers must publish failed messages to retry exchange with routing key
#   format: {event}.retry.{attempt_number}
#   They must track retry count in message headers or metadata
# ==============================================================================
