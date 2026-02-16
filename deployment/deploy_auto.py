
import pty
import os
import sys
import time

# Configuration
SERVER_IP = "65.108.255.104"
SERVER_USER = "root"
INITIAL_PASSWORD = "9eMJsXndRVVggVUfm7Xa"
NEW_PASSWORD = "Cypher2026!Secure#Update" # Strong new password
PROJECT_DIR = "/Users/Dell/Desktop/erp/cypher"

def run_command_with_password(command, password, new_password=None):
    print(f"Running: {' '.join(command)}")
    pid, fd = pty.fork()
    
    if pid == 0:
        os.execvp(command[0], command)
    else:
        output = b""
        password_changed = False
        
        while True:
            try:
                chunk = os.read(fd, 1024)
                if not chunk:
                    break
                output += chunk
                sys.stdout.buffer.write(chunk)
                sys.stdout.flush()
                
                chunk_lower = chunk.lower()

                # Handle Standard SSH Password
                if b"password:" in chunk_lower and b"new" not in chunk_lower and b"retype" not in chunk_lower:
                    time.sleep(1)
                    # If we already changed it, use new, else use initial
                    # But for this function we usually pass the 'current' valid password
                    os.write(fd, (password + "\n").encode())
                
                # Handle Host Key Verification
                if b"continue connecting" in chunk_lower:
                    time.sleep(1)
                    os.write(fd, b"yes\n")
                    
                # Handle Forced Password Change
                if b"current" in chunk_lower and b"password" in chunk_lower:
                    time.sleep(1)
                    os.write(fd, (INITIAL_PASSWORD + "\n").encode())

                if b"new password:" in chunk_lower:
                    if new_password:
                        time.sleep(1)
                        os.write(fd, (new_password + "\n").encode())
                    else:
                        print("\n[ERROR] Server asked for new password but none provided!")
                        
                if b"retype new password:" in chunk_lower:
                    if new_password:
                        time.sleep(1)
                        os.write(fd, (new_password + "\n").encode())
                        password_changed = True

            except OSError:
                break
        
        _, exit_status = os.waitpid(pid, 0)
        return os.WEXITSTATUS(exit_status), password_changed

def main():
    os.chdir(PROJECT_DIR)
    current_password = INITIAL_PASSWORD
    
    print("=== Starting Automated Deployment to Hetzner CAX21 ===")
    
    # 0. Check for forced password change via SSH first
    print("\n[0/2] Checking/Updating Server Credentials...")
    # Attempt echo command with -tt to force TTY for password change handling
    check_cmd = ["ssh", "-tt", f"{SERVER_USER}@{SERVER_IP}", "echo Connection Verified"]
    exit_code, changed = run_command_with_password(check_cmd, current_password, NEW_PASSWORD)
    
    if changed:
        print(f"\n[INFO] Password successfully changed to: {NEW_PASSWORD}")
        current_password = NEW_PASSWORD
        # Re-verify with new password
        print("   -> Verifying new credentials...")
        exit_code, _ = run_command_with_password(check_cmd, current_password)
        if exit_code != 0:
            print("[ERROR] Failed to connect with new password.")
            return
    elif exit_code != 0 and "denied" in str(exit_code): # Rough check, exit code checks are better
         # May already be changed? Try new password
        print("   -> Initial password failed. Trying NEW_PASSWORD...")
        exit_code, _ = run_command_with_password(check_cmd, NEW_PASSWORD)
        if exit_code == 0:
            print("   -> Connection successful with NEW_PASSWORD.")
            current_password = NEW_PASSWORD
        else:
            print("[ERROR] Could not authenticate with Initial or New password.")
            return

    # 1. Setup Server
    print("\n[1/2] Setting up server (Docker, Firewall)...")
    
    print("   -> Copying setup script...")
    exit_code, _ = run_command_with_password(
        ["scp", "deployment/setup_server.sh", f"{SERVER_USER}@{SERVER_IP}:/root/setup_server.sh"], 
        current_password
    )
    if exit_code != 0:
        print("Failed to copy setup script.")
        return

    print("   -> Executing setup script...")
    exit_code, _ = run_command_with_password(
        ["ssh", f"{SERVER_USER}@{SERVER_IP}", "chmod +x /root/setup_server.sh && /root/setup_server.sh"],
        current_password
    )
    if exit_code != 0:
        print("Setup script failed.")
        return

    # 2. Deploy Code
    print("\n[2/2] Deploying application...")
    
    TARGET_DIR = "/opt/cypher-erp"
    
    print("   -> Syncing files (rsync)...")
    rsync_cmd = [
        "rsync", "-avz", 
        "--exclude", "node_modules", 
        "--exclude", ".git", 
        "--exclude", "dist", 
        "--exclude", "coverage", 
        "--exclude", ".env", 
        ".", 
        f"{SERVER_USER}@{SERVER_IP}:{TARGET_DIR}"
    ]
    exit_code, _ = run_command_with_password(rsync_cmd, current_password)
    if exit_code != 0:
        print("Rsync failed.")
        return

    print("   -> Copying .env...")
    exit_code, _ = run_command_with_password(
        ["scp", ".env", f"{SERVER_USER}@{SERVER_IP}:{TARGET_DIR}/.env"],
        current_password
    )
    
    print("   -> Starting Docker Compose...")
    start_cmd = [
        "ssh", f"{SERVER_USER}@{SERVER_IP}",
        f"cd {TARGET_DIR} && docker compose up -d --build"
    ]
    exit_code, _ = run_command_with_password(start_cmd, current_password)
    
    if exit_code == 0:
        print("\nSUCCESS: Deployment completed!")
        print(f"IMPORTANT: The server password has been updated to: {NEW_PASSWORD}")
    else:
        print("\nFAILURE: Deployment failed.")

if __name__ == "__main__":
    main()
