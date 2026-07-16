# vps_setup_backend_env.py
import paramiko
import sys

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== CONFIGURANDO ENTORNO FASTAPI EN VPS ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    # 1. Crear directorios modulares del backend
    cmd_mkdir = "mkdir -p /opt/erp_inandes/backend/routers /opt/erp_inandes/backend/services"
    print("\nCreando directorios en /opt/erp_inandes/backend...")
    stdin, stdout, stderr = client.exec_command(cmd_mkdir)
    stdout.read() # esperar a que termine
    print("  [OK] Directorios creados.")

    # 2. Instalar dependencias en el venv
    cmd_pip = "/opt/erp_inandes/venv/bin/pip install fastapi uvicorn pydantic psycopg2-binary python-dotenv supabase requests"
    print("\nInstalando dependencias de FastAPI en el venv (esto puede tomar un momento)...")
    stdin, stdout, stderr = client.exec_command(cmd_pip)
    
    # Mostrar logs de instalacion en vivo
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    
    print(f"\nCodigo de salida: {exit_status}")
    if exit_status == 0:
        print("  [OK] Dependencias instaladas con éxito.")
    else:
        print("  [-] Error en la instalación:")
        print(err)
        print(out)

    client.close()

if __name__ == "__main__":
    main()
