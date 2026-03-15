#!/bin/bash
# ==============================================================================
# Rollback Script - Cypher ERP
# ==============================================================================
#
# This script provides automated rollback functionality for failed deployments.
# It can rollback the application, database, and services to a previous stable state.
#
# Usage:
#   ./scripts/rollback.sh [options]
#
# Options:
#   -v, --version VERSION    Rollback to specific version
#   -t, --tag TAG           Rollback to specific git tag
#   -c, --commit COMMIT     Rollback to specific commit
#   -s, --skip-db           Skip database rollback
#   -f, --force             Force rollback without confirmation
#   -n, --dry-run           Show what would be done without executing
#   -h, --help              Show this help message
#
# Environment Variables:
#   DEPLOYMENT_DIR          Deployment directory (default: /opt/cypher-erp)
#   BACKUP_DIR              Backup directory (default: /opt/cypher-erp/backups)
#   COMPOSE_FILE            Docker compose file (default: docker-compose.yml)
#
# ==============================================================================

set -euo pipefail

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default values
DEPLOYMENT_DIR="${DEPLOYMENT_DIR:-$PROJECT_ROOT}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_ROOT/docker-compose.yml}"
VERSION=""
TAG=""
COMMIT=""
SKIP_DB=false
FORCE=false
DRY_RUN=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Rollback state tracking
ROLLBACK_STATE_FILE="/tmp/cypher-rollback-state.json"

# Check for jq installation
if ! command -v jq &> /dev/null; then
    log_warning "jq is not installed. JSON parsing will be limited."
    HAS_JQ=false
else
    HAS_JQ=true
fi

# Simple JSON helper functions (fallback for jq)
json_set() {
    local file="$1"
    local key="$2"
    local value="$3"
    if [ "$HAS_JQ" = true ]; then
        jq --arg k "$key" --arg v "$value" '.[$k] = $v' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    else
        # Simple sed-based replacement (limited but works for basic cases)
        sed -i "s/\"$key\": \"[^\"]*\"/\"$key\": \"$value\"/g" "$file" 2>/dev/null || echo "Failed to set $key in JSON"
    fi
}

json_add_array() {
    local file="$1"
    local key="$2"
    local value="$3"
    if [ "$HAS_JQ" = true ]; then
        jq --arg k "$key" --arg v "$value" '.[$k] += [$v]' "$file" > "${file}.tmp" && mv "${file}.tmp" "$file"
    fi
}

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -t|--tag)
                TAG="$2"
                shift 2
                ;;
            -c|--commit)
                COMMIT="$2"
                shift 2
                ;;
            -s|--skip-db)
                SKIP_DB=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -n|--dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Show help message
show_help() {
    cat << EOF
Rollback Script - Cypher ERP

This script provides automated rollback functionality for failed deployments.

Usage:
    $(basename "$0") [options]

Options:
    -v, --version VERSION    Rollback to specific version
    -t, --tag TAG           Rollback to specific git tag
    -c, --commit COMMIT     Rollback to specific commit
    -s, --skip-db           Skip database rollback
    -f, --force             Force rollback without confirmation
    -n, --dry-run           Show what would be done without executing
    -h, --help              Show this help message

Environment Variables:
    DEPLOYMENT_DIR          Deployment directory (default: /opt/cypher-erp)
    BACKUP_DIR              Backup directory (default: /opt/cypher-erp/backups)
    COMPOSE_FILE            Docker compose file (default: docker-compose.yml)

Examples:
    # Rollback to specific version
    $(basename "$0") --version v1.0.0

    # Rollback to previous commit (force, no confirmation)
    $(basename "$0") --force

    # Dry run - show what would happen
    $(basename "$0") --dry-run

    # Rollback without database changes
    $(basename "$0") --skip-db
EOF
}

# Initialize rollback state
init_rollback_state() {
    cat > "$ROLLBACK_STATE_FILE" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "dry_run": $DRY_RUN,
  "skip_db": $SKIP_DB,
  "current_version": "",
  "target_version": "",
  "target_commit": "",
  "steps_completed": [],
  "steps_failed": [],
  "status": "in_progress"
}
EOF
}

# Update rollback state
update_rollback_state() {
    local step="$1"
    local status="$2"
    local details="${3:-}"

    if [ "$status" = "completed" ]; then
        jq --arg step "$step" '.steps_completed += [$step]' "$ROLLBACK_STATE_FILE" > "${ROLLBACK_STATE_FILE}.tmp"
        mv "${ROLLBACK_STATE_FILE}.tmp" "$ROLLBACK_STATE_FILE"
    elif [ "$status" = "failed" ]; then
        jq --arg step "$step" --arg details "$details" '.steps_failed += [{step: $step, details: $details}]' "$ROLLBACK_STATE_FILE" > "${ROLLBACK_STATE_FILE}.tmp"
        mv "${ROLLBACK_STATE_FILE}.tmp" "$ROLLBACK_STATE_FILE"
    fi
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if running as root or with sudo
    if [ "$EUID" -ne 0 ] && ! sudo -n true 2>/dev/null; then
        log_warning "Not running as root. Some operations may require sudo."
    fi

    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    # Check if docker compose is available
    if ! docker compose version &> /dev/null && ! docker-compose version &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi

    # Check if we're in a git repository
    if [ ! -d "$PROJECT_ROOT/.git" ]; then
        log_error "Not in a git repository"
        exit 1
    fi

    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    log_success "All prerequisites met"
}

# Get current version
get_current_version() {
    if [ -f "$PROJECT_ROOT/package.json" ]; then
        jq -r '.version' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "unknown"
    else
        echo "unknown"
    fi
}

# Get current git commit
get_current_commit() {
    git -C "$PROJECT_ROOT" rev-parse HEAD 2>/dev/null || echo "unknown"
}

# Determine rollback target
determine_rollback_target() {
    log_info "Determining rollback target..."

    CURRENT_VERSION=$(get_current_version)
    CURRENT_COMMIT=$(get_current_commit)

    log_info "Current version: $CURRENT_VERSION"
    log_info "Current commit: $CURRENT_COMMIT"

    if [ -n "$VERSION" ]; then
        # Find commit for version tag
        TARGET_COMMIT=$(git -C "$PROJECT_ROOT" rev-list -n 1 "$VERSION" 2>/dev/null || echo "")
        if [ -z "$TARGET_COMMIT" ]; then
            log_error "Version tag '$VERSION' not found"
            exit 1
        fi
    elif [ -n "$TAG" ]; then
        TARGET_COMMIT=$(git -C "$PROJECT_ROOT" rev-list -n 1 "$TAG" 2>/dev/null || echo "")
        if [ -z "$TARGET_COMMIT" ]; then
            log_error "Tag '$TAG' not found"
            exit 1
        fi
    elif [ -n "$COMMIT" ]; then
        TARGET_COMMIT="$COMMIT"
    else
        # Rollback to previous commit
        TARGET_COMMIT=$(git -C "$PROJECT_ROOT" rev-parse HEAD~1 2>/dev/null || echo "")
        if [ -z "$TARGET_COMMIT" ]; then
            log_error "No previous commit found"
            exit 1
        fi
    fi

    TARGET_VERSION=$(git -C "$PROJECT_ROOT" describe --tags "$TARGET_COMMIT" 2>/dev/null || echo "commit-$TARGET_COMMIT:0:8}")

    log_info "Target version: $TARGET_VERSION"
    log_info "Target commit: $TARGET_COMMIT"

    # Update state
    jq --arg version "$CURRENT_VERSION" --arg target "$TARGET_VERSION" --arg commit "$TARGET_COMMIT" \
       '.current_version = $version | .target_version = $target | .target_commit = $commit' \
       "$ROLLBACK_STATE_FILE" > "${ROLLBACK_STATE_FILE}.tmp"
    mv "${ROLLBACK_STATE_FILE}.tmp" "$ROLLBACK_STATE_FILE"
}

# Confirm rollback
confirm_rollback() {
    if [ "$FORCE" = true ] || [ "$DRY_RUN" = true ]; then
        return 0
    fi

    log_warning "You are about to rollback from '$CURRENT_VERSION' to '$TARGET_VERSION'"
    log_warning "This action cannot be undone!"
    echo ""
    read -p "Are you sure you want to continue? (yes/no): " confirmation

    if [ "$confirmation" != "yes" ]; then
        log_info "Rollback cancelled"
        exit 0
    fi
}

# Create backup of current state
create_backup() {
    log_info "Creating backup of current state..."

    local backup_timestamp=$(date -u +"%Y%m%d_%H%M%S")
    local backup_path="$BACKUP_DIR/backup_before_rollback_${backup_timestamp}"

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would create backup at: $backup_path"
        update_rollback_state "create_backup" "completed"
        return 0
    fi

    mkdir -p "$backup_path"

    # Backup docker volumes
    log_info "Backing up Docker volumes..."
    docker compose -f "$COMPOSE_FILE" exec -T db pg_dump -U cypher_user cypher_erp > "$backup_path/database.sql" 2>/dev/null || true

    # Backup configuration
    log_info "Backing up configuration..."
    cp -r "$PROJECT_ROOT/.env" "$backup_path/" 2>/dev/null || true
    cp -r "$PROJECT_ROOT/config" "$backup_path/" 2>/dev/null || true

    # Backup current git state
    log_info "Backing up git state..."
    git -C "$PROJECT_ROOT" show > "$backup_path/current_commit.patch" 2>/dev/null || true

    log_success "Backup created at: $backup_path"
    update_rollback_state "create_backup" "completed"
}

# Rollback application code
rollback_application() {
    log_info "Rolling back application code..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would rollback to commit: $TARGET_COMMIT"
        update_rollback_state "rollback_application" "completed"
        return 0
    fi

    # Stash any uncommitted changes
    git -C "$PROJECT_ROOT" stash push -m "Stash before rollback $(date)" 2>/dev/null || true

    # Checkout target commit
    if ! git -C "$PROJECT_ROOT" checkout "$TARGET_COMMIT"; then
        log_error "Failed to checkout commit: $TARGET_COMMIT"
        update_rollback_state "rollback_application" "failed" "Checkout failed"
        exit 1
    fi

    log_success "Application rolled back to: $TARGET_COMMIT"
    update_rollback_state "rollback_application" "completed"
}

# Rollback database
rollback_database() {
    if [ "$SKIP_DB" = true ]; then
        log_info "Skipping database rollback as requested"
        update_rollback_state "rollback_database" "skipped"
        return 0
    fi

    log_info "Rolling back database..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would rollback database migrations"
        update_rollback_state "rollback_database" "completed"
        return 0
    fi

    # Find and apply the appropriate database backup
    local latest_backup=$(find "$BACKUP_DIR" -name "database_*.sql" -type f | sort -r | head -n 1)

    if [ -z "$latest_backup" ]; then
        log_warning "No database backup found. Database will not be rolled back."
        update_rollback_state "rollback_database" "skipped" "No backup found"
        return 0
    fi

    log_info "Restoring database from: $latest_backup"

    # Stop application before database restore
    log_info "Stopping application..."
    docker compose -f "$COMPOSE_FILE" stop app || true

    # Restore database
    if docker compose -f "$COMPOSE_FILE" exec -T db psql -U cypher_user -d cypher_erp < "$latest_backup"; then
        log_success "Database rolled back"
    else
        log_error "Database rollback failed"
        update_rollback_state "rollback_database" "failed" "Restore command failed"
        exit 1
    fi

    update_rollback_state "rollback_database" "completed"
}

# Rebuild and restart services
restart_services() {
    log_info "Rebuilding and restarting services..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would rebuild and restart services"
        update_rollback_state "restart_services" "completed"
        return 0
    fi

    # Rebuild application
    log_info "Rebuilding application..."
    docker compose -f "$COMPOSE_FILE" build --no-cache app

    # Restart services
    log_info "Restarting services..."
    docker compose -f "$COMPOSE_FILE" up -d

    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 10

    # Check health
    local max_attempts=30
    local attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf http://localhost:3000/health/live > /dev/null 2>&1; then
            log_success "Services are healthy"
            update_rollback_state "restart_services" "completed"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
        echo -n "."
    done

    log_error "Services failed to become healthy"
    update_rollback_state "restart_services" "failed" "Health check timeout"
    exit 1
}

# Verify rollback
verify_rollback() {
    log_info "Verifying rollback..."

    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would verify rollback"
        return 0
    fi

    local checks_failed=0

    # Check application version
    local current_commit=$(get_current_commit)
    if [ "$current_commit" != "$TARGET_COMMIT" ]; then
        log_error "Application commit mismatch"
        checks_failed=$((checks_failed + 1))
    fi

    # Check health endpoint
    if ! curl -sf http://localhost:3000/health/live > /dev/null 2>&1; then
        log_error "Health endpoint not responding"
        checks_failed=$((checks_failed + 1))
    fi

    # Check database connectivity
    if ! docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U cypher_user > /dev/null 2>&1; then
        log_error "Database not ready"
        checks_failed=$((checks_failed + 1))
    fi

    if [ $checks_failed -eq 0 ]; then
        log_success "Rollback verification passed"
        return 0
    else
        log_error "Rollback verification failed with $checks_failed errors"
        return 1
    fi
}

# Generate rollback report
generate_report() {
    log_info "Generating rollback report..."

    local report_file="$BACKUP_DIR/rollback_report_$(date -u +"%Y%m%d_%H%M%S").json"

    jq '.status = "completed"' "$ROLLBACK_STATE_FILE" > "$report_file"

    log_success "Report generated: $report_file"
}

# Main rollback flow
main() {
    parse_arguments "$@"
    init_rollback_state
    check_prerequisites
    determine_rollback_target
    confirm_rollback
    create_backup
    rollback_application
    rollback_database
    restart_services

    if verify_rollback; then
        generate_report
        log_success "Rollback completed successfully!"
        log_info "Rolled back from: $CURRENT_VERSION"
        log_info "Rolled back to: $TARGET_VERSION"
        exit 0
    else
        log_error "Rollback verification failed!"
        log_error "Please check the logs and restore from backup if necessary"
        exit 1
    fi
}

# Run main function
main "$@"
