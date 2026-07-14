# deploy_vps.py
# Script de despliegue automatizado para el Frontend de InAndes React en Hostinger VPS
# Dominio: inandes.react.geeksoft.tech

import paramiko
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST  = "91.108.125.253"
VPS_PORT  = 22
VPS_USER  = "root"
VPS_PASS  = "Thiagutz061121@"

DOMAIN    = "inandes.react.geeksoft.tech"
APP_DIR   = "/var/www/inandes"
DIST_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dist")
CERTBOT_MAIL = "contacto@geeksoft.pe"

def put_dir(sftp, localpath, remotepath):
    """Sube de forma recursiva una carpeta local a una remota en el VPS vía SFTP."""
    try:
        sftp.mkdir(remotepath)
    except IOError:
        pass
    
    for item in os.listdir(localpath):
        localitem = os.path.join(localpath, item)
        remoteitem = remotepath + '/' + item
        if os.path.isdir(localitem):
            put_dir(sftp, localitem, remoteitem)
        else:
            sftp.put(localitem, remoteitem)

def run(client, cmd, desc=""):
    """Ejecuta un comando SSH en el VPS y muestra la salida en consola."""
    print(f"\n[{desc}]")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=120)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if out: 
        print(f"  >> {out[:400]}")
    if err and "warning" not in err.lower(): 
        print(f"  !! {err[:400]}")
    return out, err

def deploy():
    print(f"\n{'='*60}")
    print(f"  DEPLOY FRONTEND -> https://{DOMAIN}")
    print(f"{'='*60}")

    if not os.path.exists(DIST_DIR):
        print(f"[ERROR] No se encuentra la carpeta local de build: {DIST_DIR}")
        print("Asegúrate de ejecutar 'npm run build' primero antes de desplegar.")
        return

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"\nConectando a {VPS_HOST} por SSH...")
        client.connect(hostname=VPS_HOST, port=VPS_PORT, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("  >> Conexión SSH establecida con éxito ✓")

        # 1. Preparar el directorio de despliegue en el VPS
        run(client, f"mkdir -p {APP_DIR} && rm -rf {APP_DIR}/*", "1. Preparar directorio destino en VPS")

        # 2. Subir la carpeta dist compilada por SFTP
        print(f"\n[2. Subiendo archivos compilados via SFTP]")
        sftp = client.open_sftp()
        put_dir(sftp, DIST_DIR, APP_DIR)
        sftp.close()
        print(f"  >> Archivos subidos con éxito a {APP_DIR} ✓")

        # 3. Asignar los permisos correctos en Linux para el servidor web Nginx
        run(client, 
            f"find {APP_DIR} -type f -exec chmod 644 {{}} \\; && "
            f"find {APP_DIR} -type d -exec chmod 755 {{}} \\; && "
            f"chown -R www-data:www-data {APP_DIR} 2>/dev/null || true", 
            "3. Configurar permisos de lectura en el servidor")

        # 4. Crear configuración de Nginx temporal para el puerto 80 (Certbot la actualizará a HTTPS)
        nginx_cfg = f"""server {{
    listen 80;
    server_name {DOMAIN};
    root {APP_DIR};
    index index.html;

    # Proxy para el Backend en el VPS
    location /api/ {{
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}

    # Rutas SPA de React (redirección al index.html para React Router)
    location / {{
        try_files $uri $uri/ /index.html;
    }}

    # Compresión Gzip para optimizar velocidad de carga
    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
}}"""
        
        # Escribir la configuración en sites-available, habilitarla y probar Nginx
        run(client,
            f"echo '{nginx_cfg}' > /etc/nginx/sites-available/{DOMAIN} && "
            f"ln -sf /etc/nginx/sites-available/{DOMAIN} /etc/nginx/sites-enabled/{DOMAIN} && "
            f"nginx -t && systemctl reload nginx",
            "4. Configurar y recargar Nginx")

        # 5. Intentar renovar o crear el certificado SSL con Certbot de forma no interactiva
        print(f"\n[5. Comprobar / Crear Certificado SSL con Certbot]")
        out, err = run(client,
            f"certbot --nginx -d {DOMAIN} --non-interactive --agree-tos -m {CERTBOT_MAIL} --redirect",
            "5. Certbot SSL")

        if "Certificate not yet due" in out or "Successfully" in out or "Congratulations" in out:
            proto = "https"
        else:
            proto = "http"
            print("  >> SSL pendiente (DNS puede estar propagando) — disponible vía HTTP")

        print(f"\n{'='*60}")
        print(f"  [ÉXITO] APLICACIÓN REACT DESPLEGADA EN:")
        print(f"  URL: {proto}://{DOMAIN}")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\n[ERROR EN DESPLIEGUE] {e}")
    finally:
        client.close()

if __name__ == "__main__":
    deploy()
