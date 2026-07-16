# vps_free_port_8000.py
import paramiko
import sys
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== LIBERANDO PUERTO 8000 Y REINICIANDO BACKEND EN EL VPS ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    commands = [
        "fuser -k 8000/tcp || true",
        "systemctl restart inandes-backend.service",
        "sleep 3",
        "systemctl status inandes-backend.service | grep -A 4 Active"
    ]
    
    for cmd in commands:
        print(f"Ejecutando: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        if out:
            print(out.strip())

    client.close()

if __name__ == "__main__":
    main()
