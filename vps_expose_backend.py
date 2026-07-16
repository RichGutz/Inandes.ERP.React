# vps_expose_backend.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

SERVICE_EXPOSED = """[Unit]
Description=InAndes FastAPI Backend Service
After=network.target

[Service]
User=root
WorkingDirectory=/opt/erp_inandes/backend
ExecStart=/opt/erp_inandes/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
"""

def main():
    print("=== EXPONIENDO BACKEND FASTAPI PUBLICAMENTE POR PORT 8000 ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    sftp = client.open_sftp()
    service_path = "/etc/systemd/system/inandes-backend.service"
    print(f"Modificando {service_path} para --host 0.0.0.0...")
    with sftp.file(service_path, "w") as f:
        f.write(SERVICE_EXPOSED)
    sftp.close()

    commands = [
        "systemctl daemon-reload",
        "systemctl restart inandes-backend.service",
        "ufw allow 8000/tcp 2>/dev/null || iptables -A INPUT -p tcp --dport 8000 -j ACCEPT 2>/dev/null",
        "sleep 1",
        "systemctl status inandes-backend.service | grep Active"
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
