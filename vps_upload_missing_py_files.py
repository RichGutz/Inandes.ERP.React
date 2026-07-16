# vps_upload_missing_py_files.py
import paramiko
import sys
import os

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

# Archivos locales a subir
LOCAL_CUOTAS = "C:/Users/rguti/mini_erp_v2_antigravity/scripts_cuotas/generate_cuotas_v25.py"
LOCAL_COMISIONES = "C:/Users/rguti/mini_erp_v2_antigravity/decommissioned_modules_scripts_reports/scripts/generate_comisiones_asesores_v2.py"

# Destinos en el VPS
REMOTE_CUOTAS = "/opt/erp_inandes/CRM_Inandes/scripts_cuotas/generate_cuotas_v25.py"
REMOTE_COMISIONES = "/opt/erp_inandes/CRM_Inandes/scripts_cuotas/generate_comisiones_asesores_v2.py"

def main():
    print("=== SUBIENDO ARCHIVOS .PY FUENTE FALTANTES AL VPS ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    sftp = client.open_sftp()
    
    # 1. Subir generate_cuotas_v25.py
    print(f"Subiendo {os.path.basename(LOCAL_CUOTAS)}...")
    try:
        sftp.put(LOCAL_CUOTAS, REMOTE_CUOTAS)
        print(f"  [OK] Guardado en {REMOTE_CUOTAS}")
    except Exception as e:
        print(f"  [-] Error: {e}")

    # 2. Subir generate_comisiones_asesores_v2.py
    print(f"Subiendo {os.path.basename(LOCAL_COMISIONES)}...")
    try:
        sftp.put(LOCAL_COMISIONES, REMOTE_COMISIONES)
        print(f"  [OK] Guardado en {REMOTE_COMISIONES}")
    except Exception as e:
        print(f"  [-] Error: {e}")

    sftp.close()
    client.close()
    print("\n=== SUBIDA COMPLETADA ===")

if __name__ == "__main__":
    main()
