# ==============================================================================
# Cypher ERP - RabbitMQ Event Bus
# Makefile for Common Operations
#
# Usage:
#   make help                    # Show all available commands
#   make init                    # Initialize Terraform
#   make plan                    # Plan Terraform changes
#   make apply                   # Apply Terraform changes
#   make destroy                 # Destroy all resources
#   make up                      # Start RabbitMQ with Docker
#   make down                    # Stop RabbitMQ
#   make logs                    # View RabbitMQ logs
# ==============================================================================

.PHONY: help init plan apply destroy up down logs clean validate output format lint

# Default variables
ENV ?= dev
TFVARS ?= env/$(ENV).tfvars
TERRAFORM := terraform
DOCKER_COMPOSE := docker-compose

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
RED := \033[0;31m
YELLOW := \033[0;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Cypher ERP - RabbitMQ Event Bus$(NC)"
	@echo ""
	@echo "$(GREEN)Available targets:$(NC)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-20s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)
	@echo ""
	@echo "$(GREEN)Usage:$(NC)"
	@echo "  make <target> ENV=<dev|staging|prod>"
	@echo "  Example: make plan ENV=dev"

init: ## Initialize Terraform
	@echo "$(BLUE)Initializing Terraform...$(NC)"
	$(TERRAFORM) init
	@echo "$(GREEN)Terraform initialized$(NC)"

plan: ## Plan Terraform changes
	@echo "$(BLUE)Planning changes for $(ENV)...$(NC)"
	$(TERRAFORM) plan -var-file=$(TFVARS)

apply: ## Apply Terraform changes
	@echo "$(YELLOW)Applying changes for $(ENV)...$(NC)"
	$(TERRAFORM) apply -var-file=$(TFVARS) -auto-approve
	@echo "$(GREEN)Changes applied successfully$(NC)"

destroy: ## Destroy all Terraform resources
	@echo "$(RED)Destroying resources for $(ENV)...$(NC)"
	$(TERRAFORM) destroy -var-file=$(TFVARS)
	@echo "$(GREEN)Resources destroyed$(NC)"

validate: ## Validate Terraform configuration
	@echo "$(BLUE)Validating Terraform configuration...$(NC)"
	$(TERRAFORM) validate
	@echo "$(GREEN)Configuration is valid$(NC)"

format: ## Format Terraform files
	@echo "$(BLUE)Formatting Terraform files...$(NC)"
	$(TERRAFORM) fmt -recursive
	@echo "$(GREEN)Files formatted$(NC)"

lint: format validate ## Run linting (format + validate)

output: ## Show Terraform outputs
	@echo "$(BLUE)Terraform outputs:$(NC)"
	$(TERRAFORM) output

output-json: ## Show Terraform outputs as JSON
	@echo "$(BLUE)Terraform outputs (JSON):$(NC)"
	$(TERRAFORM) output -json

up: ## Start RabbitMQ with Docker Compose
	@echo "$(BLUE)Starting RabbitMQ...$(NC)"
	$(DOCKER_COMPOSE) up -d
	@echo "$(GREEN)RabbitMQ started$(NC)"
	@echo "$(GREEN)Management UI: http://localhost:15672 (admin/admin)$(NC)"

up-monitoring: ## Start RabbitMQ with monitoring (Prometheus, Grafana)
	@echo "$(BLUE)Starting RabbitMQ with monitoring...$(NC)"
	$(DOCKER_COMPOSE) --profile monitoring up -d
	@echo "$(GREEN)Services started$(NC)"
	@echo "$(GREEN)Management UI: http://localhost:15672$(NC)"
	@echo "$(GREEN)Prometheus: http://localhost:9090$(NC)"
	@echo "$(GREEN)Grafana: http://localhost:3000 (admin/admin)$(NC)"

down: ## Stop RabbitMQ
	@echo "$(BLUE)Stopping RabbitMQ...$(NC)"
	$(DOCKER_COMPOSE) down
	@echo "$(GREEN)RabbitMQ stopped$(NC)"

down-volumes: ## Stop RabbitMQ and remove volumes
	@echo "$(RED)Stopping RabbitMQ and removing volumes...$(NC)"
	$(DOCKER_COMPOSE) down -v
	@echo "$(GREEN)RabbitMQ stopped and volumes removed$(NC)"

logs: ## Show RabbitMQ logs
	$(DOCKER_COMPOSE) logs -f rabbitmq

logs-monitoring: ## Show monitoring service logs
	$(DOCKER_COMPOSE) logs -f prometheus grafana

ps: ## Show running containers
	$(DOCKER_COMPOSE) ps

clean: ## Clean up generated files
	@echo "$(YELLOW)Cleaning up...$(NC)"
	rm -rf .terraform terraform.tfstate terraform.tfstate.backup *.tfstate
	@echo "$(GREEN)Cleaned up$(NC)"

status: ## Show Terraform state
	$(TERRAFORM) show

refresh: ## Refresh Terraform state
	@echo "$(BLUE)Refreshing Terraform state...$(NC)"
	$(TERRAFORM) refresh -var-file=$(TFVARS)
	@echo "$(GREEN)State refreshed$(NC)"

import-state: ## Import existing RabbitMQ topology (requires manual mapping)
	@echo "$(YELLOW)This requires manual mapping of existing resources$(NC)"
	@echo "Example:"
	@echo "  terraform import rabbitmq_queue.my_queue /my-queue"

workspace: ## List workspaces
	@echo "$(BLUE)Workspaces:$(NC)"
	$(TERRAFORM) workspace list

workspace-new: ## Create new workspace
	@read -p "Enter workspace name: " name; \
	$(TERRAFORM) workspace new $$name

workspace-select: ## Select workspace
	@read -p "Enter workspace name: " name; \
	$(TERRAFORM) workspace select $$name

graph: ## Generate dependency graph
	@echo "$(BLUE)Generating graph...$(NC)"
	$(TERRAFORM) graph | dot -Tpng > graph.png
	@echo "$(GREEN)Graph saved to graph.png$(NC)"

# CI/CD targets
ci-init:
	$(TERRAFORM) init -backend=false

ci-validate:
	$(TERRAFORM) fmt -check -recursive
	$(TERRAFORM) validate

ci-plan:
	$(TERRAFORM) plan -var-file=$(TFVARS) -out=tfplan

# Development targets
dev-setup: up init format ## Quick development setup
	@echo "$(GREEN)Dev setup complete$(NC)"

dev-reset: down-volumes clean init up ## Reset development environment
	@echo "$(GREEN)Dev environment reset$(NC)"
