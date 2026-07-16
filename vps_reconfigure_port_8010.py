# vps_reconfigure_port_8010.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

SERVICE_8010 = """[Unit]
Description=InAndes FastAPI Backend Service
After=network.target

[Service]
User=root
WorkingDirectory=/opt/erp_inandes/backend
ExecStart=/opt/erp_inandes/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8010
Restart=always

[Install]
WantedBy=multi-user.target
"""

def main():
    print("=== RECONFIGURANDO BACKEND Y NGINX AL PUERTO 8010 ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    sftp = client.open_sftp()

    # 1. Modificar inandes-backend.service a puerto 8010
    service_path = "/etc/systemd/system/inandes-backend.service"
    print(f"Actualizando {service_path}...")
    with sftp.file(service_path, "w") as f:
        f.write(SERVICE_8010)
    print("  [OK] Servicio configurado en el puerto 8010.")

    # 2. Modificar configuracion de Nginx
    nginx_path = "/etc/nginx/sites-available/inandes.react.geeksoft.tech"
    print(f"Leyendo y modificando {nginx_path}...")
    try:
        with sftp.file(nginx_path, "r") as f:
            content = f.read().decode('utf-8')
        
        # Reemplazar el proxy pass al puerto 8010
        new_content = content.replace("proxy_pass http://127.0.0.1:8000;", "proxy_pass http://127.0.0.1:8010;")
        
        with sftp.file(nginx_path, "w") as f:
            f.write(new_content)
        print("  [OK] Configuracion de Nginx actualizada.")
    except Exception as e:
        print(f"  [-] Error al modificar Nginx: {e}")

    sftp.close()

    # 3. Aplicar cambios y recargar servicios
    commands = [
        "systemctl daemon-reload",
        "systemctl restart inandes-backend.service",
        "nginx -t",
        "systemctl reload nginx",
        "sleep 2",
        "systemctl status inandes-backend.service | grep -A 3 Active"
    ]
    
    for cmd in commands:
        print(f"Ejecutando: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        if out:
            print(out.strip())
        if err and "warn" not in err.lower() and "syntax is ok" not in err.lower():
            print(f"  [ERROR] {err.strip()}")

    client.close()

if __name__ == "__main__":
    main()
