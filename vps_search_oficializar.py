# vps_search_oficializar.py
import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== BUSCANDO PROCESO DE OFICIALIZACION EN 17_CRM_Inversionistas_v40.py ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    # Grep por insertar o registrar asientos
    cmd = "grep -n -C 5 -E 'insert|asientos|oficializar|eventos' /opt/erp_inandes/CRM_Inandes/modules/17_CRM_Inversionistas_v40.py"
    stdin, stdout, stderr = client.exec_command(cmd)
    res = stdout.read().decode('utf-8', errors='replace')
    print("\n--- Resultados del Grep ---")
    print(res)

    client.close()

if __name__ == "__main__":
    main()
