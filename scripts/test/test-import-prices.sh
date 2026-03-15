#!/bin/bash

# Test script for Excel price import
# Usage: ./test-import-prices.sh [preview|import] [file.xlsx]

set -e

API_URL="${API_URL:-http://localhost:3000}"
SMARTBILL_ENDPOINT="/api/v1/smartbill"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

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

# Get parameters
COMMAND=${1:-preview}
EXCEL_FILE=${2:-""}

log_info "Excel Price Import Test"
log_info "Command: $COMMAND"
echo ""

# Check auth token
if [ -z "$AUTH_TOKEN" ]; then
    log_warning "No AUTH_TOKEN environment variable set"
    log_info "Please set AUTH_TOKEN: export AUTH_TOKEN='your-jwt-token'"
    exit 1
fi

TOKEN="$AUTH_TOKEN"

case "$COMMAND" in
    template)
        log_info "Downloading Excel template..."
        curl -X GET \
          "${API_URL}${SMARTBILL_ENDPOINT}/template" \
          -H "Authorization: Bearer ${TOKEN}" \
          -o "price-import-template.xlsx"

        if [ -f "price-import-template.xlsx" ]; then
            log_success "Template downloaded: price-import-template.xlsx"
            log_info "Open it in Excel, fill in the prices, and save"
        else
            log_error "Failed to download template"
            exit 1
        fi
        ;;

    preview|import)
        if [ -z "$EXCEL_FILE" ]; then
            log_error "Please provide Excel file path"
            log_info "Usage: $0 $COMMAND file.xlsx"
            exit 1
        fi

        if [ ! -f "$EXCEL_FILE" ]; then
            log_error "File not found: $EXCEL_FILE"
            exit 1
        fi

        DRY_RUN="true"
        if [ "$COMMAND" = "import" ]; then
            DRY_RUN="false"
            log_warning "⚠️  This will UPDATE prices in the database!"
            read -p "Continue? (yes/no): " CONFIRM
            if [ "$CONFIRM" != "yes" ]; then
                log_info "Import cancelled"
                exit 0
            fi
        fi

        log_info "Uploading Excel file: $EXCEL_FILE"
        log_info "Mode: $([ "$DRY_RUN" = "true" ] && echo "Preview" || echo "Real Import")"

        RESPONSE=$(curl -s -X POST \
          "${API_URL}${SMARTBILL_ENDPOINT}/import-prices" \
          -H "Authorization: Bearer ${TOKEN}" \
          -F "file=@${EXCEL_FILE}" \
          -F "dryRun=${DRY_RUN}" \
          -F "vatRate=19" \
          -F "priceIncludesVat=true")

        echo "$RESPONSE" | jq '.'

        # Extract stats
        SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
        if [ "$SUCCESS" = "true" ]; then
            TOTAL=$(echo "$RESPONSE" | jq -r '.data.totalRows')
            VALID=$(echo "$RESPONSE" | jq -r '.data.validRows')
            UPDATED=$(echo "$RESPONSE" | jq -r '.data.productsUpdated')
            NOT_FOUND=$(echo "$RESPONSE" | jq -r '.data.productsNotFound')
            ERRORS=$(echo "$RESPONSE" | jq -r '.data.errors | length')

            echo ""
            log_success "Processing completed!"
            log_info "Total rows: $TOTAL"
            log_info "Valid rows: $VALID"
            log_info "Products updated: $UPDATED"
            log_info "Products not found: $NOT_FOUND"
            log_info "Errors: $ERRORS"

            if [ "$ERRORS" -gt 0 ]; then
                log_warning "There were $ERRORS errors. Check the response above for details."
            fi
        else
            log_error "Processing failed!"
        fi
        ;;

    check)
        log_info "Checking recent price updates in database..."
        docker exec cypher-erp-db psql -U cypher_user -d cypher_erp -c \
          "SELECT sku, name, base_price, currency_code, updated_at
           FROM products
           WHERE updated_at > NOW() - INTERVAL '1 hour'
             AND base_price > 0
           ORDER BY updated_at DESC
           LIMIT 20;"
        ;;

    stats)
        log_info "Getting price statistics..."
        docker exec cypher-erp-db psql -U cypher_user -d cypher_erp -c \
          "SELECT
             COUNT(*) as total_products,
             COUNT(CASE WHEN base_price > 0 THEN 1 END) as with_price,
             COUNT(CASE WHEN base_price = 0 THEN 1 END) as without_price,
             ROUND(AVG(CASE WHEN base_price > 0 THEN base_price END), 2) as avg_price,
             ROUND(MIN(CASE WHEN base_price > 0 THEN base_price END), 2) as min_price,
             ROUND(MAX(base_price), 2) as max_price
           FROM products
           WHERE is_active = true;"
        ;;

    *)
        log_error "Unknown command: $COMMAND"
        echo ""
        echo "Usage: $0 [command] [options]"
        echo ""
        echo "Commands:"
        echo "  template            - Download Excel template"
        echo "  preview file.xlsx   - Preview import without making changes"
        echo "  import file.xlsx    - Import prices (updates database)"
        echo "  check               - Check recent price updates"
        echo "  stats               - Show price statistics"
        echo ""
        echo "Examples:"
        echo "  $0 template"
        echo "  $0 preview my-prices.xlsx"
        echo "  $0 import my-prices.xlsx"
        echo "  $0 check"
        echo "  $0 stats"
        exit 1
        ;;
esac

echo ""
log_success "Done!"
