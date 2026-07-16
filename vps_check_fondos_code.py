# vps_check_fondos_code.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== LEYENDO LINEAS DE FONDOS Y ASESORES EN EL VPS ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    # 1. Leer 19_CRM_Fondos.py
    print("\n--- Cabecera 19_CRM_Fondos.py ---")
    cmd_f = "head -n 200 /opt/erp_inandes/CRM_Inandes/modules/19_CRM_Fondos.py"
    stdin, stdout, stderr = client.exec_command(cmd_f)
    print(stdout.read().decode('utf-8', errors='replace'))

    # 2. Leer 23_CRM_Asesores.py
    print("\n--- Cabecera 23_CRM_Asesores.py ---")
    cmd_a = "head -n 200 /opt/erp_inandes/CRM_Inandes/modules/23_CRM_Asesores.py"
    stdin, stdout, stderr = client.exec_command(cmd_a)
    print(stdout.read().decode('utf-8', errors='replace'))

    client.close()

if __name__ == "__main__":
    main()
