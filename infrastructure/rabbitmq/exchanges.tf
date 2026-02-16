# ==============================================================================
# Cypher ERP - RabbitMQ Event Bus
# Exchange Definitions
#
# Description:
#   This file defines all message exchanges used in the Cypher ERP event bus.
#   Exchanges are the routing points where messages are published before being
#   delivered to queues based on binding keys.
#
# Exchange Types:
#   - topic: Flexible routing based on wildcard patterns (* and #)
#   - durable: Survives broker restarts
#
# Naming Convention:
#   cypher.{environment}.events.{type}
#
# ==============================================================================

# ==============================================================================
# Main Events Exchange
# ==============================================================================
# Type: topic
# Purpose: Primary exchange for all domain events in the system
# Usage: Publishers send all domain events here with routing keys like:
#   - product.created
#   - product.updated
#   - product.deleted
#   - order.created
#   - order.paid
#   - order.cancelled
#   - price.changed
# ==============================================================================

resource "rabbitmq_exchange" "events_topic" {
  name  = local.exchange_names.events
  type  = "topic"
  durable = true

  tags {
    name  = "domain"
    value = "cypher-erp"
  }

  tags {
    name  = "purpose"
    value = "event-bus"
  }

  tags {
    name  = "environment"
    value = var.environment
  }
}

# ==============================================================================
# Retry Exchange
# ==============================================================================
# Type: topic
# Purpose: Handles messages that need to be retried with delay
# Usage: Failed messages are routed here with TTL, then returned to main exchange
#
# Retry Pattern:
#   1. Message fails in worker queue
#   2. Sent to retry exchange with specific routing key (e.g., "order.created.retry.1")
#   3. Retry queue expires message after TTL
#   4. Message forwarded back to main exchange via DLX
#   5. Message is reprocessed
#
# Routing Keys:
#   - {event}.retry.1 (first retry, TTL 10s)
#   - {event}.retry.2 (second retry, TTL 60s)
#   - {event}.retry.3 (third retry, TTL 5min)
# ==============================================================================

resource "rabbitmq_exchange" "events_retry" {
  name  = local.exchange_names.retry
  type  = "topic"
  durable = true

  tags {
    name  = "domain"
    value = "cypher-erp"
  }

  tags {
    name  = "purpose"
    value = "retry-exchange"
  }

  tags {
    name  = "environment"
    value = var.environment
  }
}

# ==============================================================================
# Dead Letter Queue (DLQ) Exchange
# ==============================================================================
# Type: topic
# Purpose: Final destination for messages that have exhausted retry attempts
# Usage: Failed messages are sent here for inspection and manual recovery
#
# DLQ Pattern:
#   - Messages reach DLQ after max retry attempts
#   - Can be inspected via RabbitMQ Management UI
#   - Can be re-injected to main exchange after issue resolution
#
# Routing Keys:
#   - Same as original event (e.g., "product.updated")
#   - x-death header contains retry count and original queue
# ==============================================================================

resource "rabbitmq_exchange" "events_dlq" {
  name  = local.exchange_names.dlq
  type  = "topic"
  durable = true

  tags {
    name  = "domain"
    value = "cypher-erp"
  }

  tags {
    name  = "purpose"
    value = "dead-letter-exchange"
  }

  tags {
    name  = "environment"
    value = var.environment
  }
}

# ==============================================================================
# Exchange Summary
# ==============================================================================
# Total Exchanges: 3
#   1. cypher.{env}.events.topic    - Main event bus
#   2. cypher.{env}.events.retry    - Retry with delay
#   3. cypher.{env}.events.dlq      - Failed messages
# ==============================================================================
