# deploy_backend_vps.py
import paramiko
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST  = "91.108.125.253"
VPS_PORT  = 22
VPS_USER  = "root"
VPS_PASS  = "Thiagutz061121@"

REMOTE_DIR = "/opt/erp_inandes/backend"
LOCAL_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")

def put_dir(sftp, localpath, remotepath):
    """Sube de forma recursiva archivos y carpetas locales a la ruta remota."""
    try:
        sftp.mkdir(remotepath)
        print(f"Creado directorio remoto: {remotepath}")
    except IOError:
        pass
    
    for item in os.listdir(localpath):
        localitem = os.path.join(localpath, item)
        remoteitem = remotepath + '/' + item
        if os.path.isdir(localitem):
            if item == "__pycache__":
                continue
            put_dir(sftp, localitem, remoteitem)
        else:
            print(f"Subiendo: {item} -> {remotepath}")
            sftp.put(localitem, remoteitem)

def main():
    print("=== INICIANDO DESPLIEGUE DEL BACKEND FASTAPI ===")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        print(f"Conectando al VPS {VPS_HOST}...")
        client.connect(VPS_HOST, port=VPS_PORT, username=VPS_USER, password=VPS_PASS, timeout=30)
        print("[OK] Conectado.")
        
        # Subir todos los archivos vía SFTP
        sftp = client.open_sftp()
        put_dir(sftp, LOCAL_DIR, REMOTE_DIR)
        sftp.close()
        
        # Escribir el archivo .env en el VPS
        print("\nConfigurando variables de entorno (.env) en el VPS...")
        env_cmd = (
            f"echo 'SUPABASE_URL=https://egvcinsbyropumybatdf.supabase.co' > {REMOTE_DIR}/.env && "
            f"echo 'SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVndmNpbnNieXJvcHVteWJhdGRmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDA0NDczNCwiZXhwIjoyMDk5NjIwNzM0fQ.28T_xQmSRJO1O1scio61JU0KHhEQfzSS94qYka8TrcA' >> {REMOTE_DIR}/.env"
        )
        stdin, stdout, stderr = client.exec_command(env_cmd)
        stdout.read()
        print("  [OK] Archivo .env creado en el servidor.")
        
        print("\n=== DESPLIEGUE COMPLETADO CON EXITO ===")
        
    except Exception as e:
        print(f"[-] Error durante el despliegue: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    main()
