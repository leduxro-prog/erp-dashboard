# ==============================================================================
# Cypher ERP - RabbitMQ Event Bus
# Output Values
#
# Description:
#   This file defines all output values that are exported after Terraform apply.
#   These outputs can be referenced by other Terraform configurations or used
#   in CI/CD pipelines for configuration generation.
#
# Usage:
#   terraform output
#   terraform output -raw rabbitmq_url
#   terraform output -json > outputs.json
#
# ==============================================================================

# ==============================================================================
# Exchange Outputs
# ==============================================================================

output "exchange_events" {
  description = "Main events exchange name"
  value       = rabbitmq_exchange.events_topic.name
}

output "exchange_retry" {
  description = "Retry exchange name"
  value       = rabbitmq_exchange.events_retry.name
}

output "exchange_dlq" {
  description = "Dead Letter Queue exchange name"
  value       = rabbitmq_exchange.events_dlq.name
}

output "all_exchanges" {
  description = "List of all exchange names"
  value = [
    rabbitmq_exchange.events_topic.name,
    rabbitmq_exchange.events_retry.name,
    rabbitmq_exchange.events_dlq.name,
  ]
}

# ==============================================================================
# Queue Outputs
# ==============================================================================

output "queue_search_indexer_product_updated" {
  description = "Search indexer queue for product.updated events"
  value       = rabbitmq_queue.search_indexer_product_updated.name
}

output "queue_pricing_worker_price_changed" {
  description = "Pricing worker queue for price.changed events"
  value       = rabbitmq_queue.pricing_worker_price_changed.name
}

output "queue_notification_worker_order_created" {
  description = "Notification worker queue for order.created events"
  value       = rabbitmq_queue.notification_worker_order_created.name
}

output "queue_credit_worker_order_cancelled" {
  description = "Credit worker queue for order.cancelled events"
  value       = rabbitmq_queue.credit_worker_order_cancelled.name
}

output "queue_erp_sync_order_created" {
  description = "ERP sync queue for order.created events"
  value       = rabbitmq_queue.erp_sync_order_created.name
}

output "all_main_queues" {
  description = "List of all main consumer queues"
  value = [
    rabbitmq_queue.search_indexer_product_updated.name,
    rabbitmq_queue.pricing_worker_price_changed.name,
    rabbitmq_queue.notification_worker_order_created.name,
    rabbitmq_queue.credit_worker_order_cancelled.name,
    rabbitmq_queue.erp_sync_order_created.name,
  ]
}

# ==============================================================================
# Retry Queue Outputs
# ==============================================================================

output "retry_queues" {
  description = "Map of retry queues with their TTL values"
  value = {
    product_updated = {
      attempt_1 = {
        name = rabbitmq_queue.retry_product_updated_1.name
        ttl   = local.retry_ttls.attempt_1
      }
      attempt_2 = {
        name = rabbitmq_queue.retry_product_updated_2.name
        ttl   = local.retry_ttls.attempt_2
      }
      attempt_3 = {
        name = rabbitmq_queue.retry_product_updated_3.name
        ttl   = local.retry_ttls.attempt_3
      }
    }
    price_changed = {
      attempt_1 = {
        name = rabbitmq_queue.retry_price_changed_1.name
        ttl   = local.retry_ttls.attempt_1
      }
      attempt_2 = {
        name = rabbitmq_queue.retry_price_changed_2.name
        ttl   = local.retry_ttls.attempt_2
      }
      attempt_3 = {
        name = rabbitmq_queue.retry_price_changed_3.name
        ttl   = local.retry_ttls.attempt_3
      }
    }
    order_created = {
      attempt_1 = {
        name = rabbitmq_queue.retry_order_created_1.name
        ttl   = local.retry_ttls.attempt_1
      }
      attempt_2 = {
        name = rabbitmq_queue.retry_order_created_2.name
        ttl   = local.retry_ttls.attempt_2
      }
      attempt_3 = {
        name = rabbitmq_queue.retry_order_created_3.name
        ttl   = local.retry_ttls.attempt_3
      }
    }
    order_cancelled = {
      attempt_1 = {
        name = rabbitmq_queue.retry_order_cancelled_1.name
        ttl   = local.retry_ttls.attempt_1
      }
      attempt_2 = {
        name = rabbitmq_queue.retry_order_cancelled_2.name
        ttl   = local.retry_ttls.attempt_2
      }
      attempt_3 = {
        name = rabbitmq_queue.retry_order_cancelled_3.name
        ttl   = local.retry_ttls.attempt_3
      }
    }
  }
}

# ==============================================================================
# DLQ Outputs
# ==============================================================================

output "dlq_product_updated" {
  description = "DLQ for product.updated events"
  value       = rabbitmq_queue.dlq_product_updated.name
}

output "dlq_price_changed" {
  description = "DLQ for price.changed events"
  value       = rabbitmq_queue.dlq_price_changed.name
}

output "dlq_order_created" {
  description = "DLQ for order.created events"
  value       = rabbitmq_queue.dlq_order_created.name
}

output "dlq_order_cancelled" {
  description = "DLQ for order.cancelled events"
  value       = rabbitmq_queue.dlq_order_cancelled.name
}

output "all_dlq_queues" {
  description = "List of all DLQ queues"
  value = [
    rabbitmq_queue.dlq_product_updated.name,
    rabbitmq_queue.dlq_price_changed.name,
    rabbitmq_queue.dlq_order_created.name,
    rabbitmq_queue.dlq_order_cancelled.name,
  ]
}

# ==============================================================================
# Connection Information
# ==============================================================================

output "rabbitmq_host" {
  description = "RabbitMQ management API host"
  value       = var.rabbitmq_host
  sensitive   = false
}

output "rabbitmq_port" {
  description = "RabbitMQ management API port"
  value       = var.rabbitmq_port
  sensitive   = false
}

output "rabbitmq_vhost" {
  description = "RabbitMQ virtual host"
  value       = var.rabbitmq_vhost
}

output "rabbitmq_management_url" {
  description = "RabbitMQ Management UI URL"
  value       = "${var.rabbitmq_protocol}://${var.rabbitmq_host}:${var.rabbitmq_port}"
}

output "rabbitmq_amqp_url" {
  description = "RabbitMQ AMQP connection URL (without credentials)"
  value       = "amqp://${var.rabbitmq_host}:5672${var.rabbitmq_vhost != "/" ? "/${var.rabbitmq_vhost}" : ""}"
}

# ==============================================================================
# Configuration for Applications
# ==============================================================================

output "application_config" {
  description = "Complete configuration object for application consumption"
  value = {
    rabbitmq = {
      host      = var.rabbitmq_host
      port      = 5672
      vhost     = var.rabbitmq_vhost
      exchanges = {
        events = rabbitmq_exchange.events_topic.name
        retry  = rabbitmq_exchange.events_retry.name
        dlq    = rabbitmq_exchange.events_dlq.name
      }
      queues = {
        search_indexer = {
          product_updated = rabbitmq_queue.search_indexer_product_updated.name
        }
        pricing_worker = {
          price_changed = rabbitmq_queue.pricing_worker_price_changed.name
        }
        notification_worker = {
          order_created = rabbitmq_queue.notification_worker_order_created.name
        }
        credit_worker = {
          order_cancelled = rabbitmq_queue.credit_worker_order_cancelled.name
        }
        erp_sync = {
          order_created = rabbitmq_queue.erp_sync_order_created.name
        }
      }
      routing_keys = {
        product_updated = "product.updated"
        price_changed   = "price.changed"
        order_created   = "order.created"
        order_cancelled = "order.cancelled"
      }
      retry = {
        enabled      = var.retry_enabled
        max_attempts = var.retry_max_attempts
        ttls = {
          attempt_1 = local.retry_ttls.attempt_1
          attempt_2 = local.retry_ttls.attempt_2
          attempt_3 = local.retry_ttls.attempt_3
        }
      }
    }
    environment = var.environment
  }
}

# ==============================================================================
# Monitoring and Observability
# ==============================================================================

output "monitoring_config" {
  description = "Configuration for monitoring integration"
  value = {
    enabled = var.monitoring_enabled
    metrics = {
      queue_prefixes = [
        "cypher.${var.environment}.search-indexer",
        "cypher.${var.environment}.pricing-worker",
        "cypher.${var.environment}.notification-worker",
        "cypher.${var.environment}.credit-worker",
        "cypher.${var.environment}.erp-sync",
      ]
      dlq_prefix = "cypher.${var.environment}.dlq"
      retry_prefix = "cypher.${var.environment}.retry"
    }
    alerts = {
      high_queue_length_threshold = 10000
      dlq_messages_threshold     = 100
    }
  }
}

# ==============================================================================
# Summary Statistics
# ==============================================================================

output "topology_summary" {
  description = "Summary of the deployed topology"
  value = {
    exchanges = {
      count = 3
      names = [
        rabbitmq_exchange.events_topic.name,
        rabbitmq_exchange.events_retry.name,
        rabbitmq_exchange.events_dlq.name,
      ]
    }
    queues = {
      total     = 21
      main      = 5
      retry     = 12
      dlq       = 4
      names = {
        main  = length(rabbitmq_queue.all_main_queues)
        retry = 12
        dlq   = 4
      }
    }
    bindings = {
      total = 21
      main  = 5
      retry = 12
      dlq   = 4
    }
    supported_events = [
      "product.updated",
      "price.changed",
      "order.created",
      "order.cancelled",
    ]
  }
}

# ==============================================================================
# Sensitive Outputs
# ==============================================================================
# Marked as sensitive to prevent accidental exposure in logs

output "rabbitmq_credentials" {
  description = "RabbitMQ connection credentials (SENSITIVE)"
  value = {
    username = var.rabbitmq_username
    password = var.rabbitmq_password
  }
  sensitive = true
}

output "rabbitmq_connection_string" {
  description = "Complete AMQP connection string (SENSITIVE)"
  value       = "amqp://${var.rabbitmq_username}:${var.rabbitmq_password}@${var.rabbitmq_host}:5672${var.rabbitmq_vhost != "/" ? "/${var.rabbitmq_vhost}" : ""}"
  sensitive   = true
}
