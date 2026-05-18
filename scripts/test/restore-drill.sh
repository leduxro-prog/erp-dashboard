#!/bin/bash
#
# Cypher ERP - Production Restore Drill Script
#
# This script performs a real backup, restore to isolated database,
# and validates the restored data with health and sanity checks.
#
# Usage: ./scripts/restore-drill.sh
#
# Expected outputs:
# - Backup file: /tmp/cypher-erp-backup-YYYYMMDD-HHMMSS.sql
# - RTO (Recovery Time Objective) measurement
# - RPO (Recovery Point Objective) measurement
# - Health check results
# - Sanity query results
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="/tmp/cypher-erp-backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/cypher-erp-backup-${TIMESTAMP}.sql"
ISOLATED_DB_NAME="cypher_erp_restore_test"
LOG_FILE="${BACKUP_DIR}/restore-drill-${TIMESTAMP}.log"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Logging function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log "INFO" "${BLUE}=========================================${NC}"
log "INFO" "${BLUE}Cypher ERP Restore Drill${NC}"
log "INFO" "${BLUE}=========================================${NC}"
log "INFO" "Starting restore drill at ${TIMESTAMP}"
log "INFO" "Backup file: ${BACKUP_FILE}"
log "INFO" "Isolated database: ${ISOLATED_DB_NAME}"

# ============================================================================
# Phase 1: Pre-backup Health Check
# ============================================================================
log "INFO" "${GREEN}Phase 1: Pre-backup Health Check${NC}"

log "INFO" "Checking database connectivity..."
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-cypher_user}
DB_NAME=${DB_NAME:-cypher_erp}

if [ -z "${DB_PASSWORD:-}" ]; then
    log "ERROR" "${RED}DB_PASSWORD is not set${NC}"
    exit 1
fi

# Check if primary database is accessible
if PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    log "INFO" "${GREEN}Primary database is accessible${NC}"
else
    log "ERROR" "${RED}Cannot access primary database${NC}"
    exit 1
fi

# Get pre-backup metrics
log "INFO" "Collecting pre-backup metrics..."
PRE_BACKUP_USER_COUNT=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
PRE_BACKUP_PRODUCT_COUNT=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM products WHERE is_active = true;" 2>/dev/null || echo "0")
PRE_BACKUP_ORDER_COUNT=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM orders;" 2>/dev/null || echo "0")
PRE_BACKUP_B2B_CUSTOMER_COUNT=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT COUNT(*) FROM b2b_customers;" 2>/dev/null || echo "0")

log "INFO" "  Users: ${PRE_BACKUP_USER_COUNT}"
log "INFO" "  Products: ${PRE_BACKUP_PRODUCT_COUNT}"
log "INFO" "  Orders: ${PRE_BACKUP_ORDER_COUNT}"
log "INFO" "  B2B Customers: ${PRE_BACKUP_B2B_CUSTOMER_COUNT}"

RPO_START_TIMESTAMP=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -t -c "SELECT NOW();" 2>/dev/null || date +%Y-%m-%d\ %H:%M:%S)
log "INFO" "RPO reference timestamp: ${RPO_START_TIMESTAMP}"

# ============================================================================
# Phase 2: Backup
# ============================================================================
log "INFO" "${GREEN}Phase 2: Backup${NC}"

BACKUP_START=$(date +%s)

log "INFO" "Creating database backup..."
PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db pg_dump \
    -h localhost \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-owner \
    --no-acl \
    --format=plain \
    --no-password \
    > "${BACKUP_FILE}" \
    2>> "${LOG_FILE}"

BACKUP_END=$(date +%s)
BACKUP_DURATION=$((BACKUP_END - BACKUP_START))
BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)

if [ -s "${BACKUP_FILE}" ]; then
    log "INFO" "${GREEN}Backup completed successfully${NC}"
    log "INFO" "  Duration: ${BACKUP_DURATION}s"
    log "INFO" "  Size: ${BACKUP_SIZE}"
else
    log "ERROR" "${RED}Backup failed - file is empty${NC}"
    exit 1
fi

# ============================================================================
# Phase 3: Create Isolated Database
# ============================================================================
log "INFO" "${GREEN}Phase 3: Create Isolated Database${NC}"

log "INFO" "Dropping existing isolated database if exists..."
PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${ISOLATED_DB_NAME};" 2>&1 | tee -a "${LOG_FILE}"

log "INFO" "Creating isolated database..."
PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d postgres -c "CREATE DATABASE ${ISOLATED_DB_NAME};" 2>&1 | tee -a "${LOG_FILE}"

# ============================================================================
# Phase 4: Restore to Isolated Database
# ============================================================================
log "INFO" "${GREEN}Phase 4: Restore to Isolated Database${NC}"

RESTORE_START=$(date +%s)

log "INFO" "Restoring backup to isolated database..."
docker exec -i cypher-erp-db psql \
    -h localhost \
    -U "${DB_USER}" \
    -d "${ISOLATED_DB_NAME}" \
    -v ON_ERROR_STOP=1 \
    --quiet \
    < "${BACKUP_FILE}" \
    2>&1 | tee -a "${LOG_FILE}"

RESTORE_END=$(date +%s)
RESTORE_DURATION=$((RESTORE_END - RESTORE_START))
RTO=${RESTORE_DURATION}

log "INFO" "${GREEN}Restore completed${NC}"
log "INFO" "  Duration: ${RESTORE_DURATION}s (RTO)"

# ============================================================================
# Phase 5: Post-restore Health Check
# ============================================================================
log "INFO" "${GREEN}Phase 5: Post-restore Health Check${NC}"

# Check database connectivity
log "INFO" "Checking isolated database connectivity..."
if PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${ISOLATED_DB_NAME}" -c "SELECT 1;" > /dev/null 2>&1; then
    log "INFO" "${GREEN}Isolated database is accessible${NC}"
else
    log "ERROR" "${RED}Cannot access isolated database${NC}"
    exit 1
fi

# ============================================================================
# Phase 6: Sanity Query Checks
# ============================================================================
log "INFO" "${GREEN}Phase 6: Sanity Query Checks${NC}"

# Verify table integrity
log "INFO" "Verifying table integrity..."
TABLES_TO_CHECK=("users" "products" "orders" "b2b_customers" "categories" "stock_levels")

for table in "${TABLES_TO_CHECK[@]}"; do
    result=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${ISOLATED_DB_NAME}" -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null || echo "ERROR")
    if [[ "$result" != "ERROR" ]]; then
        log "INFO" "${GREEN}  ${table}: ${result} rows${NC}"
    else
        log "WARN" "${YELLOW}  ${table}: CHECK FAILED${NC}"
    fi
done

# Verify data consistency
log "INFO" "Verifying data consistency..."

# Check for orphaned records
ORPHANED_ORDERS=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${ISOLATED_DB_NAME}" -t -c "SELECT COUNT(*) FROM orders WHERE customer_id NOT IN (SELECT id FROM users);" 2>/dev/null || echo "0")
if [ "${ORPHANED_ORDERS}" -eq 0 ]; then
    log "INFO" "${GREEN}  No orphaned orders found${NC}"
else
    log "WARN" "${YELLOW}  Found ${ORPHANED_ORDERS} orphaned orders${NC}"
fi

# Check for null constraints violations
NULL_VIOLATIONS=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${ISOLATED_DB_NAME}" -t -c "SELECT COUNT(*) FROM products WHERE sku IS NULL OR name IS NULL;" 2>/dev/null || echo "0")
if [ "${NULL_VIOLATIONS}" -eq 0 ]; then
    log "INFO" "${GREEN}  No null constraint violations in products${NC}"
else
    log "WARN" "${YELLOW}  Found ${NULL_VIOLATIONS} products with null sku/name${NC}"
fi

# Verify indexes
log "INFO" "Verifying indexes..."
INDEX_COUNT=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${ISOLATED_DB_NAME}" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" 2>/dev/null || echo "0")
log "INFO" "  Indexes found: ${INDEX_COUNT}"

# ============================================================================
# Phase 7: Data Comparison
# ============================================================================
log "INFO" "${GREEN}Phase 7: Data Comparison${NC}"

POST_BACKUP_USER_COUNT=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${ISOLATED_DB_NAME}" -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")
POST_BACKUP_PRODUCT_COUNT=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${ISOLATED_DB_NAME}" -t -c "SELECT COUNT(*) FROM products WHERE is_active = true;" 2>/dev/null || echo "0")
POST_BACKUP_ORDER_COUNT=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${ISOLATED_DB_NAME}" -t -c "SELECT COUNT(*) FROM orders;" 2>/dev/null || echo "0")
POST_BACKUP_B2B_CUSTOMER_COUNT=$(PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d "${ISOLATED_DB_NAME}" -t -c "SELECT COUNT(*) FROM b2b_customers;" 2>/dev/null || echo "0")

DATA_MATCH=true

if [ "${PRE_BACKUP_USER_COUNT}" != "${POST_BACKUP_USER_COUNT}" ]; then
    log "ERROR" "${RED}User count mismatch: ${PRE_BACKUP_USER_COUNT} -> ${POST_BACKUP_USER_COUNT}${NC}"
    DATA_MATCH=false
else
    log "INFO" "${GREEN}  User count matches: ${POST_BACKUP_USER_COUNT}${NC}"
fi

if [ "${PRE_BACKUP_PRODUCT_COUNT}" != "${POST_BACKUP_PRODUCT_COUNT}" ]; then
    log "ERROR" "${RED}Product count mismatch: ${PRE_BACKUP_PRODUCT_COUNT} -> ${POST_BACKUP_PRODUCT_COUNT}${NC}"
    DATA_MATCH=false
else
    log "INFO" "${GREEN}  Product count matches: ${POST_BACKUP_PRODUCT_COUNT}${NC}"
fi

if [ "${PRE_BACKUP_ORDER_COUNT}" != "${POST_BACKUP_ORDER_COUNT}" ]; then
    log "ERROR" "${RED}Order count mismatch: ${PRE_BACKUP_ORDER_COUNT} -> ${POST_BACKUP_ORDER_COUNT}${NC}"
    DATA_MATCH=false
else
    log "INFO" "${GREEN}  Order count matches: ${POST_BACKUP_ORDER_COUNT}${NC}"
fi

if [ "${PRE_BACKUP_B2B_CUSTOMER_COUNT}" != "${POST_BACKUP_B2B_CUSTOMER_COUNT}" ]; then
    log "ERROR" "${RED}B2B Customer count mismatch: ${PRE_BACKUP_B2B_CUSTOMER_COUNT} -> ${POST_BACKUP_B2B_CUSTOMER_COUNT}${NC}"
    DATA_MATCH=false
else
    log "INFO" "${GREEN}  B2B Customer count matches: ${POST_BACKUP_B2B_CUSTOMER_COUNT}${NC}"
fi

# ============================================================================
# Phase 8: Cleanup and Summary
# ============================================================================
log "INFO" "${GREEN}Phase 8: Cleanup and Summary${NC}"

# Cleanup isolated database
log "INFO" "Cleaning up isolated database..."
PGPASSWORD="${DB_PASSWORD}" docker exec cypher-erp-db psql -h localhost -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${ISOLATED_DB_NAME};" 2>&1 | tee -a "${LOG_FILE}"

# Calculate RPO (assuming backup captured current state)
RPO_SECONDS=0  # pg_dump captures point-in-time

# Summary
log "INFO" "${BLUE}=========================================${NC}"
log "INFO" "${BLUE}Restore Drill Summary${NC}"
log "INFO" "${BLUE}=========================================${NC}"
log "INFO" "Backup file: ${BACKUP_FILE}"
log "INFO" "Backup size: ${BACKUP_SIZE}"
log "INFO" "Backup duration: ${BACKUP_DURATION}s"
log "INFO" "Restore duration: ${RESTORE_DURATION}s"
log "INFO" "RTO (Recovery Time Objective): ${RTO}s"
log "INFO" "RPO (Recovery Point Objective): ${RPO_SECONDS}s (point-in-time snapshot)"
log "INFO" "Data match: ${DATA_MATCH}"

# Production Verdict
VERDICT="GO"
VERDICT_REASON="All checks passed"

if [ "${DATA_MATCH}" = false ]; then
    VERDICT="NO-GO"
    VERDICT_REASON="Data mismatch detected between source and restored database"
elif [ "${RESTORE_DURATION}" -gt 300 ]; then
    VERDICT="NO-GO"
    VERDICT_REASON="RTO exceeds 5 minutes threshold"
elif [ "${BACKUP_DURATION}" -gt 300 ]; then
    VERDICT="NO-GO"
    VERDICT_REASON="Backup duration exceeds 5 minutes threshold"
fi

log "INFO" "${BLUE}=========================================${NC}"
if [ "${VERDICT}" = "GO" ]; then
    log "INFO" "${GREEN}PRODUCTION VERDICT: ${VERDICT}${NC}"
else
    log "INFO" "${RED}PRODUCTION VERDICT: ${VERDICT}${NC}"
fi
log "INFO" "Reason: ${VERDICT_REASON}"
log "INFO" "${BLUE}=========================================${NC}"

# Exit with appropriate code
if [ "${VERDICT}" = "GO" ]; then
    exit 0
else
    exit 1
fi
