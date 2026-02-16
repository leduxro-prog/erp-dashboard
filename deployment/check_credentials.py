
import pty
import os
import sys
import time

SERVER_IP = "65.108.255.104"
SERVER_USER = "root"
PASSWORDS = ["9eMJsXndRVVggVUfm7Xa", "Cypher2026!Secure#Update"]

def try_login(password):
    print(f"Trying password: {password[:5]}...{password[-3:]}")
    command = ["ssh", "-tt", f"{SERVER_USER}@{SERVER_IP}", "echo SUCCESS"]
    pid, fd = pty.fork()
    
    if pid == 0:
        os.execvp(command[0], command)
    else:
        output = b""
        success = False
        while True:
            try:
                chunk = os.read(fd, 1024)
                if not chunk: break
                output += chunk
                
                if b"password:" in chunk.lower() and b"new" not in chunk.lower():
                    time.sleep(0.5)
                    os.write(fd, (password + "\n").encode())
                
                if b"SUCCESS" in chunk:
                    success = True
                    # success, but process might not exit immediately
            except OSError:
                break
        
        os.waitpid(pid, 0)
        return success, output

for pwd in PASSWORDS:
    is_valid, out = try_login(pwd)
    if is_valid:
        print(f"\nVALID PASSWORD FOUND: {pwd}")
        exit(0)
    else:
        print(f"Failed with {pwd}")
        # print(out.decode(errors='ignore'))

print("\nNO VALID PASSWORD FOUND.")
