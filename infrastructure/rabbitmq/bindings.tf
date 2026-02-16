# ==============================================================================
# Cypher ERP - RabbitMQ Event Bus
# Queue to Exchange Bindings
#
# Description:
#   This file defines the bindings between exchanges and queues.
#   Bindings determine which routing keys are forwarded to which queues.
#
# Binding Pattern:
#   - Queue binds to Exchange with specific Routing Key
#   - Topic exchanges support wildcards: * (single word), # (zero+ words)
#
# Binding Types:
#   1. Direct binding: Exact routing key match
#   2. Wildcard binding: Pattern matching with * or #
#
# ==============================================================================

# ==============================================================================
# product.updated Bindings
# ==============================================================================
# Routing Key: product.updated
# Target Queue: search-indexer.product-updated
# Purpose: Update search index when product data changes
# ==============================================================================

resource "rabbitmq_binding" "search_indexer_product_updated" {
  source           = rabbitmq_exchange.events_topic.name
  vhost            = "/"
  destination      = rabbitmq_queue.search_indexer_product_updated.name
  destination_type = "queue"
  routing_key      = "product.updated"
}

# ==============================================================================
# price.changed Bindings
# ==============================================================================
# Routing Key: price.changed
# Target Queue: pricing-worker.price-changed
# Purpose: Update pricing tables when prices change
# ==============================================================================

resource "rabbitmq_binding" "pricing_worker_price_changed" {
  source           = rabbitmq_exchange.events_topic.name
  vhost            = "/"
  destination      = rabbitmq_queue.pricing_worker_price_changed.name
  destination_type = "queue"
  routing_key      = "price.changed"
}

# ==============================================================================
# order.created Bindings
# ==============================================================================
# Routing Key: order.created
# Target Queues:
#   1. notification-worker.order-created (customer notifications)
#   2. erp-sync.order-created (ERP synchronization)
# Purpose: Multiple consumers for the same event (fanout pattern via topic)
# ==============================================================================

# Binding 1: Notification Worker
resource "rabbitmq_binding" "notification_worker_order_created" {
  source           = rabbitmq_exchange.events_topic.name
  vhost            = "/"
  destination      = rabbitmq_queue.notification_worker_order_created.name
  destination_type = "queue"
  routing_key      = "order.created"
}

# Binding 2: ERP Sync
resource "rabbitmq_binding" "erp_sync_order_created" {
  source           = rabbitmq_exchange.events_topic.name
  vhost            = "/"
  destination      = rabbitmq_queue.erp_sync_order_created.name
  destination_type = "queue"
  routing_key      = "order.created"
}

# ==============================================================================
# order.cancelled Bindings
# ==============================================================================
# Routing Key: order.cancelled
# Target Queue: credit-worker.order-cancelled
# Purpose: Handle credit restoration when orders are cancelled
# ==============================================================================

resource "rabbitmq_binding" "credit_worker_order_cancelled" {
  source           = rabbitmq_exchange.events_topic.name
  vhost            = "/"
  destination      = rabbitmq_queue.credit_worker_order_cancelled.name
  destination_type = "queue"
  routing_key      = "order.cancelled"
}

# ==============================================================================
# Wildcard Binding Examples (Future Expansion)
# ==============================================================================
# These are commented examples showing how to use pattern matching
# Uncomment and modify as needed for your use cases

# Example: All product events
# resource "rabbitmq_binding" "product_events_wildcard" {
#   source           = rabbitmq_exchange.events_topic.name
#   vhost            = "/"
#   destination      = rabbitmq_queue.example_queue.name
#   destination_type = "queue"
#   routing_key      = "product.*"
# }

# Example: All order events (including sub-events like order.paid, order.shipped)
# resource "rabbitmq_binding" "order_events_wildcard" {
#   source           = rabbitmq_exchange.events_topic.name
#   vhost            = "/"
#   destination      = rabbitmq_queue.example_queue.name
#   destination_type = "queue"
#   routing_key      = "order.#"
# }

# ==============================================================================
# Binding Summary
# ==============================================================================
# Total Bindings: 5
#
# Exchange            | Routing Key    | Queue (Destination)
# -------------------|----------------|----------------------------------------
# events.topic        | product.updated| q.search-indexer.product-updated
# events.topic        | price.changed  | q.pricing-worker.price-changed
# events.topic        | order.created  | q.notification-worker.order-created
# events.topic        | order.created  | q.erp-sync.order-created
# events.topic        | order.cancelled| q.credit-worker.order-cancelled
#
# Note: order.created has 2 bindings (fanout pattern)
# ==============================================================================
