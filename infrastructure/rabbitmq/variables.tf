# ==============================================================================
# Cypher ERP - RabbitMQ Event Bus
# Input Variables
#
# Description:
#   This file defines all configurable input variables for the RabbitMQ topology.
#   Variables should be provided via .tfvars files or environment variables.
#
# Usage:
#   terraform apply -var-file="env/dev.tfvars"
#   terraform apply -var="environment=staging"
#
# ==============================================================================

# ==============================================================================
# Connection Variables
# ==============================================================================

variable "rabbitmq_host" {
  description = "RabbitMQ management API hostname or IP address"
  type        = string
  default     = "localhost"
}

variable "rabbitmq_port" {
  description = "RabbitMQ management API port (typically 15672 for HTTP API)"
  type        = number
  default     = 15672
  validation {
    condition     = var.rabbitmq_port >= 1 && var.rabbitmq_port <= 65535
    error_message = "Port must be between 1 and 65535."
  }
}

variable "rabbitmq_username" {
  description = "Username for RabbitMQ management API authentication"
  type        = string
  sensitive   = true
  default     = "admin"
}

variable "rabbitmq_password" {
  description = "Password for RabbitMQ management API authentication"
  type        = string
  sensitive   = true
  default     = "admin"
}

variable "rabbitmq_protocol" {
  description = "Protocol for connecting to RabbitMQ (http or https)"
  type        = string
  default     = "http"
  validation {
    condition     = contains(["http", "https"], var.rabbitmq_protocol)
    error_message = "Protocol must be either 'http' or 'https'."
  }
}

variable "rabbitmq_vhost" {
  description = "RabbitMQ virtual host to use"
  type        = string
  default     = "/"
}

# ==============================================================================
# Environment Configuration
# ==============================================================================

variable "environment" {
  description = "Deployment environment (dev, staging, or prod)"
  type        = string
  default     = "dev"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "region" {
  description = "AWS or cloud region for resource tagging"
  type        = string
  default     = "eu-central-1"
}

# ==============================================================================
# Retry Configuration
# ==============================================================================

variable "retry_enabled" {
  description = "Enable retry queues and bindings"
  type        = bool
  default     = true
}

variable "retry_max_attempts" {
  description = "Maximum number of retry attempts before sending to DLQ"
  type        = number
  default     = 3
  validation {
    condition     = var.retry_max_attempts >= 1 && var.retry_max_attempts <= 10
    error_message = "Max retry attempts must be between 1 and 10."
  }
}

variable "retry_ttl_attempt_1" {
  description = "TTL in milliseconds for first retry attempt"
  type        = number
  default     = 10000  # 10 seconds
}

variable "retry_ttl_attempt_2" {
  description = "TTL in milliseconds for second retry attempt"
  type        = number
  default     = 60000  # 60 seconds (1 minute)
}

variable "retry_ttl_attempt_3" {
  description = "TTL in milliseconds for third retry attempt"
  type        = number
  default     = 300000  # 300 seconds (5 minutes)
}

variable "retry_ttl_attempt_4" {
  description = "TTL in milliseconds for fourth retry attempt"
  type        = number
  default     = 600000  # 600 seconds (10 minutes)
}

# ==============================================================================
# Queue Configuration
# ==============================================================================

variable "queue_durable" {
  description = "Set all queues as durable (survive broker restart)"
  type        = bool
  default     = true
}

variable "queue_default_max_length" {
  description = "Default maximum queue length before dropping oldest messages"
  type        = number
  default     = 100000
}

variable "queue_message_ttl" {
  description = "Default message TTL in milliseconds (null for no expiration)"
  type        = number
  default     = 86400000  # 24 hours
  validation {
    condition     = var.queue_message_ttl == null || var.queue_message_ttl > 0
    error_message = "Message TTL must be null or a positive number."
  }
}

# Per-queue TTL configurations
variable "queue_ttl_search_indexer" {
  description = "Message TTL for search indexer queues (milliseconds)"
  type        = number
  default     = 86400000  # 24 hours
}

variable "queue_ttl_pricing_worker" {
  description = "Message TTL for pricing worker queues (milliseconds)"
  type        = number
  default     = 86400000  # 24 hours
}

variable "queue_ttl_notification_worker" {
  description = "Message TTL for notification worker queues (milliseconds)"
  type        = number
  default     = 604800000  # 7 days
}

variable "queue_ttl_credit_worker" {
  description = "Message TTL for credit worker queues (milliseconds)"
  type        = number
  default     = 43200000  # 12 hours
}

variable "queue_ttl_erp_sync" {
  description = "Message TTL for ERP sync queues (milliseconds)"
  type        = number
  default     = 86400000  # 24 hours
}

# ==============================================================================
# Exchange Configuration
# ==============================================================================

variable "exchange_durable" {
  description = "Set all exchanges as durable"
  type        = bool
  default     = true
}

variable "exchange_autodelete" {
  description = "Auto-delete exchanges when no bindings remain"
  type        = bool
  default     = false
}

# ==============================================================================
# Dead Letter Queue Configuration
# ==============================================================================

variable "dlq_enabled" {
  description = "Enable dead letter queues"
  type        = bool
  default     = true
}

variable "dlq_max_length" {
  description = "Maximum DLQ size before dropping oldest messages"
  type        = number
  default     = 100000
}

variable "dlq_ttl" {
  description = "DLQ message TTL in milliseconds (null for indefinite retention)"
  type        = number
  default     = null
}

# ==============================================================================
# Resource Tags
# ==============================================================================

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default = {
    Project     = "Cypher-ERP"
    ManagedBy   = "Terraform"
    Component   = "EventBus"
  }
}

variable "monitoring_enabled" {
  description = "Enable monitoring and alerting for queues"
  type        = bool
  default     = true
}

# ==============================================================================
# Advanced Configuration
# ==============================================================================

variable "use_ssl" {
  description = "Use SSL/TLS for RabbitMQ connections"
  type        = bool
  default     = false
}

variable "verify_ssl" {
  description = "Verify SSL certificates (only when use_ssl is true)"
  type        = bool
  default     = true
}

variable "connection_timeout" {
  description = "Connection timeout in seconds"
  type        = number
  default     = 30
}

variable "queue_mode" {
  description = "Queue mode (default, lazy)"
  type        = string
  default     = "default"
  validation {
    condition     = contains(["default", "lazy"], var.queue_mode)
    error_message = "Queue mode must be either 'default' or 'lazy'."
  }
}
