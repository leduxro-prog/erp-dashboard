# ==============================================================================
# Cypher ERP - RabbitMQ Event Bus
# Terraform Providers Configuration
#
# This file is separate from main.tf for clarity and can be overridden
# with override.tf for local development.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    rabbitmq = {
      source  = "cyrilgdn/postgresql/rabbitmq"
      version = "~> 2.2.0"
    }

    # Optional: Kubernetes provider for Kubernetes-based RabbitMQ
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.24.0"
    }

    # Optional: Helm provider for RabbitMQ Operator
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.12.0"
    }
  }
}

# Provider block is in main.tf to use variables
# This file can be extended with provider-specific configurations
