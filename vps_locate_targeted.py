# vps_locate_targeted.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== BUSCANDO COMISIONES EN /opt/erp_inandes/CRM_Inandes/ ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    # 1. Buscar directorio scripts_cuotas
    print("\n--- Directorios scripts_cuotas ---")
    cmd_dir = "find /opt/erp_inandes/CRM_Inandes/ -type d -name 'scripts_cuotas' 2>/dev/null"
    stdin, stdout, stderr = client.exec_command(cmd_dir)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    # 2. Grep por definicion de funcion
    print("\n--- Grep por definicion de funcion ---")
    cmd_grep = "grep -rn 'def generate_proyeccion_comisiones' /opt/erp_inandes/CRM_Inandes/ 2>/dev/null"
    stdin, stdout, stderr = client.exec_command(cmd_grep)
    print(stdout.read().decode('utf-8', errors='replace').strip())

    client.close()

if __name__ == "__main__":
    main()
