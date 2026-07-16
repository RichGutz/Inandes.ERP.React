# vps_view_v40_code.py
import paramiko
import sys

VPS_HOST = "91.108.125.253"
VPS_USER = "root"
VPS_PASS = "Thiagutz061121@"

def main():
    print("=== LEYENDO LINEAS 300-400 DE CALCULO_Retornos_Intereses_v40.py ===")
    
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(hostname=VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[OK] Conectado al VPS.")
    except Exception as e:
        print(f"[-] Error de conexion SSH: {e}")
        sys.exit(1)

    cmd = "sed -n '300,400p' /opt/erp_inandes/CRM_Inandes/modules/CALCULO_Retornos_Intereses_v40.py"
    stdin, stdout, stderr = client.exec_command(cmd)
    code = stdout.read().decode('utf-8', errors='replace')
    print("\n--- CODIGO V40 ---")
    print(code)

    client.close()

if __name__ == "__main__":
    main()
