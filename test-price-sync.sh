#!/bin/bash

# Test script for SmartBill price synchronization
# Usage: ./test-price-sync.sh [preview|sync] [daysBack]

set -e

API_URL="${API_URL:-http://localhost:3000}"
SMARTBILL_ENDPOINT="/api/v1/smartbill"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get command and parameters
COMMAND=${1:-preview}
DAYS_BACK=${2:-90}

log_info "SmartBill Price Sync Test"
log_info "Command: $COMMAND"
log_info "Days back: $DAYS_BACK"
echo ""

# Get authentication token (assuming you have credentials)
log_info "Authenticating..."
# You need to replace these with actual credentials or get token another way
# TOKEN=$(curl -s -X POST "${API_URL}/api/v1/auth/login" \
#   -H "Content-Type: application/json" \
#   -d '{"email":"admin@example.com","password":"password"}' \
#   | jq -r '.data.token')

# For testing, we'll check if token is provided via env
if [ -z "$AUTH_TOKEN" ]; then
    log_warning "No AUTH_TOKEN environment variable set"
    log_info "Please set AUTH_TOKEN or modify this script with credentials"
    log_info "Example: export AUTH_TOKEN='your-jwt-token'"
    exit 1
fi

TOKEN="$AUTH_TOKEN"
log_success "Authentication successful"
echo ""

# Execute command
case "$COMMAND" in
    preview)
        log_info "Running price preview (no database changes)..."
        RESPONSE=$(curl -s -X GET \
          "${API_URL}${SMARTBILL_ENDPOINT}/preview-prices?daysBack=${DAYS_BACK}" \
          -H "Authorization: Bearer ${TOKEN}" \
          -H "Content-Type: application/json")

        echo "$RESPONSE" | jq '.'

        # Extract stats
        TOTAL_INVOICES=$(echo "$RESPONSE" | jq -r '.data.totalInvoices // 0')
        TOTAL_PRODUCTS=$(echo "$RESPONSE" | jq -r '.data.totalProducts // 0')

        echo ""
        log_success "Preview completed!"
        log_info "Total invoices found: $TOTAL_INVOICES"
        log_info "Total products with prices: $TOTAL_PRODUCTS"
        ;;

    sync)
        log_info "Running price synchronization (WILL UPDATE DATABASE)..."
        log_warning "This will update product prices in the database!"

        # Prompt for confirmation
        read -p "Continue? (yes/no): " CONFIRM
        if [ "$CONFIRM" != "yes" ]; then
            log_info "Sync cancelled by user"
            exit 0
        fi

        STRATEGY="${3:-latest}"
        log_info "Using strategy: $STRATEGY"

        RESPONSE=$(curl -s -X POST \
          "${API_URL}${SMARTBILL_ENDPOINT}/sync-prices?daysBack=${DAYS_BACK}&strategy=${STRATEGY}" \
          -H "Authorization: Bearer ${TOKEN}" \
          -H "Content-Type: application/json")

        echo "$RESPONSE" | jq '.'

        # Extract stats
        TOTAL_INVOICES=$(echo "$RESPONSE" | jq -r '.data.totalInvoices // 0')
        PRODUCTS_UPDATED=$(echo "$RESPONSE" | jq -r '.data.productsUpdated // 0')
        UNIQUE_PRODUCTS=$(echo "$RESPONSE" | jq -r '.data.uniqueProducts // 0')
        ERROR_COUNT=$(echo "$RESPONSE" | jq -r '.data.errors | length // 0')

        echo ""
        if [ "$ERROR_COUNT" -gt 0 ]; then
            log_warning "Sync completed with errors!"
        else
            log_success "Sync completed successfully!"
        fi

        log_info "Total invoices processed: $TOTAL_INVOICES"
        log_info "Unique products found: $UNIQUE_PRODUCTS"
        log_info "Products updated: $PRODUCTS_UPDATED"
        log_info "Errors: $ERROR_COUNT"
        ;;

    check-db)
        log_info "Checking database for price updates..."
        docker exec cypher-erp-db psql -U cypher_user -d cypher_erp -c \
          "SELECT
             COUNT(*) as total,
             COUNT(CASE WHEN base_price > 0 THEN 1 END) as with_price,
             ROUND(AVG(CASE WHEN base_price > 0 THEN base_price END), 2) as avg_price
           FROM products
           WHERE is_active = true AND currency_code = 'RON';"

        echo ""
        log_info "Recently updated products (top 10):"
        docker exec cypher-erp-db psql -U cypher_user -d cypher_erp -c \
          "SELECT sku, name, base_price, updated_at
           FROM products
           WHERE base_price > 0 AND currency_code = 'RON'
           ORDER BY updated_at DESC
           LIMIT 10;"
        ;;

    *)
        log_error "Unknown command: $COMMAND"
        echo ""
        echo "Usage: $0 [command] [daysBack] [strategy]"
        echo ""
        echo "Commands:"
        echo "  preview     - Preview prices without updating (default)"
        echo "  sync        - Synchronize prices (updates database)"
        echo "  check-db    - Check database for current price statistics"
        echo ""
        echo "Parameters:"
        echo "  daysBack    - Number of days to look back (default: 90)"
        echo "  strategy    - 'latest' or 'average' (default: latest, only for sync)"
        echo ""
        echo "Examples:"
        echo "  $0 preview 30"
        echo "  $0 sync 90 latest"
        echo "  $0 check-db"
        exit 1
        ;;
esac

echo ""
log_success "Test completed!"
