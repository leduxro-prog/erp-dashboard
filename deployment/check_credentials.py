# ==============================================================================
# DEPRECATED - Credential brute-force checker
# ==============================================================================
# This script has been deprecated and MUST NOT be used.
#
# WHY: It contained plaintext passwords and attempted password-based SSH login,
# which is a security anti-pattern.
#
# REPLACEMENT: All server access uses SSH key authentication only.
# To verify SSH key connectivity, use:
#   ssh -i <key_file> <user>@<host> "echo OK"
#
# See deployment/deploy_with_key.sh for the correct approach.
# ==============================================================================

import sys

def main():
    print("=" * 60)
    print("DEPRECATED: This script has been removed for security.")
    print("")
    print("Password-based credential checking is not supported.")
    print("Use SSH key authentication to verify server access:")
    print("  ssh -i <key_file> <user>@<host> 'echo OK'")
    print("=" * 60)
    sys.exit(1)

if __name__ == "__main__":
    main()
