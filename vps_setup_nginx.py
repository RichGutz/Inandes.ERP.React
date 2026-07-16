# vps_setup_nginx.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

NGINX_CONF = """server {
    listen 80;
    server_name api.inandes.react.geeksoft.tech;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
"""

def main():
    print("=== CONFIGURANDO NGINX Y CERTBOT SSL EN EL VPS ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    sftp = client.open_sftp()
    
    # 1. Escribir configuracion de Nginx
    nginx_path = "/etc/nginx/sites-available/api.inandes.react.geeksoft.tech"
    print(f"Creando {nginx_path}...")
    with sftp.file(nginx_path, "w") as f:
        f.write(NGINX_CONF)
    print("  [OK] Bloque Nginx configurado.")
    sftp.close()

    # 2. Habilitar sitio y recargar Nginx
    print("\nActivando sitio y recargando Nginx...")
    commands = [
        "ln -sf /etc/nginx/sites-available/api.inandes.react.geeksoft.tech /etc/nginx/sites-enabled/",
        "nginx -t",
        "systemctl reload nginx",
        "certbot --nginx -d api.inandes.react.geeksoft.tech --non-interactive --agree-tos --email contacto@geeksoft.pe"
    ]
    
    for cmd in commands:
        print(f"Ejecutando: {cmd}")
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        if out:
            print(out.strip())
        if err:
            print(f"  [LOG/WARN/ERROR] {err.strip()}")

    client.close()

if __name__ == "__main__":
    main()
