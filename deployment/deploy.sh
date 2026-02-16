#!/bin/bash
# ==============================================================================
# DEPRECATED - Password-based deploy script
# ==============================================================================
# This script is deprecated. Use deploy_with_key.sh instead.
#
# Why: This script relied on password-based SSH, which is insecure.
# The only supported deployment methods are:
#   1. GitHub Actions: .github/workflows/deploy-hetzner.yml
#   2. Manual deploy:  deployment/deploy_with_key.sh (SSH key auth)
# ==============================================================================

set -euo pipefail

echo "================================================================"
echo "DEPRECATED: This script is no longer supported."
echo ""
echo "Use key-based deployment instead:"
echo "  ./deployment/deploy_with_key.sh"
echo ""
echo "Or use GitHub Actions (deploy-hetzner.yml)."
echo "================================================================"
exit 1
