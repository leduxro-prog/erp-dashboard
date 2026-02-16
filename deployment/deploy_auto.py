# ==============================================================================
# DEPRECATED - Automated deployment with password authentication
# ==============================================================================
# This script has been deprecated and MUST NOT be used.
#
# WHY: It contained plaintext server passwords and used password-based SSH
# authentication, which is a critical security risk.
#
# REPLACEMENT: Use key-based deployment only:
#   - CI/CD:  .github/workflows/deploy-hetzner.yml (GitHub Actions)
#   - Manual: deployment/deploy_with_key.sh (SSH key auth)
#
# All server access MUST use SSH key authentication.
# See docs/HETZNER_CUTOVER_RUNBOOK.md for deployment procedures.
# ==============================================================================

import sys

def main():
    print("=" * 60)
    print("DEPRECATED: This script has been removed for security.")
    print("")
    print("Password-based deployment is no longer supported.")
    print("Use one of the following instead:")
    print("  1. GitHub Actions: .github/workflows/deploy-hetzner.yml")
    print("  2. Manual deploy:  deployment/deploy_with_key.sh")
    print("=" * 60)
    sys.exit(1)

if __name__ == "__main__":
    main()
