# vps_setup_systemd.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

SERVICE_CONTENT = """[Unit]
Description=InAndes FastAPI Backend Service
After=network.target

[Service]
User=root
WorkingDirectory=/opt/erp_inandes/backend
ExecStart=/opt/erp_inandes/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
"""

def main():
    print("=== CONFIGURANDO SERVICIO SYSTEMD EN EL VPS ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    sftp = client.open_sftp()
    
    # 1. Escribir el archivo del servicio
    service_path = "/etc/systemd/system/inandes-backend.service"
    print(f"Creando {service_path}...")
    with sftp.file(service_path, "w") as f:
        f.write(SERVICE_CONTENT)
    print("  [OK] Archivo de servicio creado.")
    sftp.close()

    # 2. Habilitar e iniciar el servicio
    print("\nHabilitando e iniciando el servicio inandes-backend...")
    commands = [
        "systemctl daemon-reload",
        "systemctl enable inandes-backend.service",
        "systemctl restart inandes-backend.service",
        "sleep 2",
        "systemctl status inandes-backend.service"
    ]
    
    for cmd in commands:
        print(f"Ejecutando: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        if out:
            print(out.strip())
        if err:
            print(f"  [ERROR/WARN] {err.strip()}")

    client.close()

if __name__ == "__main__":
    main()
